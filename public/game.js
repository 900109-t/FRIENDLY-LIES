const socket=io();
let roomId;
let ability;
let useAb=false;

function createRoom(){
  fetch("/create").then(r=>r.json()).then(d=>{
    alert("Room ID: "+d.roomId);
  });
}

function joinRoom(){
  roomId=document.getElementById("roomInput").value;
  socket.emit("join",{roomId});
}

socket.on("ability",(a)=>{
  ability=a;
  document.getElementById("ability").innerText="능력: "+a;
});

socket.on("start",()=>{
  document.getElementById("game").style.display="block";
});

function sendChoice(choice){
  socket.emit("choice",{roomId,choice,useAbility:useAb});
  useAb=false;
}

function useAbility(){
  useAb=true;
  alert("이번 선택에 능력 사용됨");
}

socket.on("result",(data)=>{
  document.getElementById("round").innerText="Round "+data.round;
  document.getElementById("log").innerText=
    JSON.stringify(data,null,2);
});

socket.on("gameOver",(scores)=>{
  alert("게임 종료\n"+JSON.stringify(scores));
});