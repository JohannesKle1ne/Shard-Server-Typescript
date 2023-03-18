"use strict";

import express, { Response, Request, Express } from "express";
import { Server, WebSocketServer, WebSocket } from "ws";
import path from "./testPlayer.json";

enum MessageType {
  Position,
  Destroy,
  DestroyRequest,
  Color,
  BoxPosition,
  Unknown,
}

const PORT = process.env.PORT || 3001;
const INDEX = "/index.html";

let stateMapping: StateMapping[] = [];

const colors = ["blue", "green", "red"];
let colorIndex = 0;
const getColor = () => {
  colorIndex = (colorIndex + 1) % colors.length;
  return colors[colorIndex];
};

function getState(client: WebSocket) {
  const mapping = stateMapping.find((m) => m.client === client);
  if (mapping) return mapping.state;
}

function removeState(client: WebSocket) {
  stateMapping = stateMapping.filter((m) => m.client !== client);
}

function send(client: WebSocket, message: string) {
  const state = getState(client);
  if (state && state.handShake) {
    console.log("Sent: " + message);
    client.send(message);
  }
}

function getMessageType(message: string) {
  let messageObj;
  try {
    messageObj = JSON.parse(message);
  } catch (error) {
    return MessageType.Unknown;
  }
  if (messageObj.type == null) {
    return MessageType.Unknown;
  }
  return messageObj.type;
}

const server = express()
  .use((req: Request, res: Response) =>
    res.sendFile(INDEX, { root: __dirname })
  )
  .listen(PORT, () => console.log(`Listening on ${PORT}`));

const wss: WebSocketServer = new Server({ server });

setInterval(() => {
  wss.clients.forEach((c) => {
    const state = getState(c);
    if (state?.handShake) {
      send(
        c,
        JSON.stringify({
          type: MessageType.BoxPosition,
          position: 600,
          index: 0,
        })
      );
    }
  });
}, 6000);

setInterval(() => {
  wss.clients.forEach((c) => {
    const state = getState(c);
    if (state?.handShake) {
      send(
        c,
        JSON.stringify({
          type: MessageType.BoxPosition,
          position: 550,
          index: 1,
        })
      );
    }
  });
}, 10000);

setInterval(() => {
  wss.clients.forEach((c) => {
    const state = getState(c);
    if (state?.handShake) {
      send(
        c,
        JSON.stringify({
          type: MessageType.BoxPosition,
          position: 420,
          index: 2,
        })
      );
    }
  });
}, 6000);

wss.on("connection", (ws: WebSocket) => {
  console.log("Client connected");
  stateMapping.push({ client: ws, state: new ClientState() });
  ws.on("close", () => {
    console.log("start disconnecting");
    wss.clients.forEach((client) => {
      const state = getState(ws);
      if (state) {
        console.log(state.objectPositions);
        state.objectPositions.forEach(({ objectId, clientId }) => {
          send(
            client,
            JSON.stringify({ clientId, type: MessageType.Destroy, objectId })
          );
        });
      }
    });
    removeState(ws);
    console.log("Client disconnected");
  });
  ws.on("message", (message) => {
    //for each websocket client
    const messageString = `${message}`;
    console.log("Received: " + messageString);

    if (isNumeric(messageString)) {
      const state = getState(ws);
      if (state) {
        state.handShake = true;
        state.id = parseInt(messageString);
        const newColor = getColor();

        setTimeout(() => {
          send(
            ws,
            JSON.stringify({
              clientId: state.id,
              type: MessageType.Color,
              color: newColor,
            })
          );
          wss.clients.forEach((client) => {
            if (client != ws) {
              const state = getState(client);
              if (state) {
                state.objectPositions.forEach((position) => {
                  send(ws, JSON.stringify(position));
                });
              }
            }
          });
        }, 500);
      }
    }

    const type = getMessageType(`${message}`);
    if (type === MessageType.Position) {
      const mPos: Position = JSON.parse(`${message}`);
      const state = getState(ws);
      if (state) {
        state.objectPositions = state.objectPositions.filter(
          (p) => p.objectId !== mPos.objectId
        );
        state.objectPositions.push(mPos);
      }
    }
    if (type === MessageType.Destroy) {
      const mPos: Destroy = JSON.parse(`${message}`);
      const state = getState(ws);
      if (state) {
        state.objectPositions = state.objectPositions.filter(
          (p) => p.objectId !== mPos.objectId
        );
      }
    }

    wss.clients.forEach((client) => {
      //send the client the current message
      if (client != ws) {
        send(client, `${message}`);
      }
    });
  });
});

/* let index = 0;
setInterval(() => {
  wss.clients.forEach((client) => {
    const position = path[index];
    send(client, JSON.stringify(position));
    index = (index + 1) % path.length;
  });
}, 100); */

const startPositions = [
  { x: 50, y: 330 },
  { x: 300, y: 330 },
];

function getRandomStartPosition() {
  return startPositions[getRandom(2)];
}

function getRandom(max: number) {
  return Math.floor(Math.random() * max);
}

function isNumeric(str: string) {
  if (typeof str != "string") return false; // we only process strings!
  return !isNaN(parseInt(str)); // ...and ensure strings of whitespace fail
}

class ClientState {
  handShake: boolean = false;
  objectPositions: Position[] = [];
  id: number = -1;
}

interface StateMapping {
  client: WebSocket;
  state: ClientState;
}

interface Position {
  clientId: number;
  x: number;
  y: number;
  type: MessageType;
  sprite: string;
  objectType: string;
  objectId: number;
}

interface Destroy {
  clientId: number;
  type: MessageType.Destroy;
  objectId: number;
}

/* interface ObjectState {
  objectId: number;
  sprite: string;
  x: number;
  y: number;
} */
