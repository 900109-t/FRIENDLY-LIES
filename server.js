const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const crypto = require("crypto");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));
app.use(express.json());

const PORT = 3000;
const ADMIN_PASSWORD = "admin123";

let rooms = {};
let stats = {
  totalGames: 0,
  coop: 0,
  betray: 0,
  abilityUsage: { peek: 0, fake: 0, double: 0 }
};

function randomAbility() {
  return ["peek", "fake", "double"][Math.floor(Math.random()*3)];
}

function createRoom() {
  const id = crypto.randomBytes(3).toString("hex");
  rooms[id] = {
    players: [],
    scores: {},
    round: 1,
    choices: {},
    abilities: {},
    used: {}
  };
  return id;
}

app.get("/create", (req,res)=>{
  const id = createRoom();
  res.json({ roomId: id });
});

io.on("connection", socket => {

  socket.on("join", ({roomId})=>{
    const room = rooms[roomId];
    if(!room) return;

    if(room.players.length>=2) return;

    room.players.push(socket.id);
    room.scores[socket.id]=0;
    room.abilities[socket.id]=randomAbility();
    room.used[socket.id]=false;

    socket.join(roomId);
    socket.emit("ability", room.abilities[socket.id]);

    if(room.players.length===2){
      io.to(roomId).emit("start");
    }
  });

  socket.on("choice", ({roomId, choice, useAbility})=>{
    const room=rooms[roomId];
    if(!room) return;

    room.choices[socket.id]=choice;

    if(useAbility && !room.used[socket.id]){
      const ab=room.abilities[socket.id];
      stats.abilityUsage[ab]++;
      room.used[socket.id]=true;
      room.activeAbility = {player:socket.id,type:ab};
    }

    if(Object.keys(room.choices).length===2){
      resolveRound(roomId);
    }
  });

  socket.on("disconnect",()=>{
    for(let id in rooms){
      if(rooms[id].players.includes(socket.id)){
        delete rooms[id];
      }
    }
  });

});

function resolveRound(roomId){
  const room=rooms[roomId];
  const [p1,p2]=room.players;

  let c1=room.choices[p1];
  let c2=room.choices[p2];

  if(c1==="coop") stats.coop++;
  if(c1==="betray") stats.betray++;
  if(c2==="coop") stats.coop++;
  if(c2==="betray") stats.betray++;

  let s1=0,s2=0;

  if(c1==="coop"&&c2==="coop"){ s1=2; s2=2; }
  else if(c1==="coop"&&c2==="betray"){ s1=-1; s2=3; }
  else if(c1==="betray"&&c2==="coop"){ s1=3; s2=-1; }

  if(room.activeAbility){
    if(room.activeAbility.type==="double"){
      if(room.activeAbility.player===p1) s1*=2;
      if(room.activeAbility.player===p2) s2*=2;
    }
  }

  room.scores[p1]+=s1;
  room.scores[p2]+=s2;

  io.to(roomId).emit("result",{
    choices:{p1:c1,p2:c2},
    scores:room.scores,
    round:room.round
  });

  room.round++;
  room.choices={};
  room.activeAbility=null;

  if(room.round>5){
    stats.totalGames++;
    io.to(roomId).emit("gameOver",room.scores);
    delete rooms[roomId];
  }
}

app.get("/admin/stats",(req,res)=>{
  res.json({...stats, activeRooms:Object.keys(rooms).length});
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});