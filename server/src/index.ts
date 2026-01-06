import Fastify from "fastify";
import cors from "@fastify/cors";
import { Server } from "socket.io";
import { createServer } from "http";

const fastify = Fastify();
const PORT = Number(process.env.PORT) || 3001;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "*";

const TURN_TIME_MS = 30_000;
const QUESTION_TIME_MS = 20_000;

/* ------------------ Types ------------------ */

type Player = {
  id: string;
  name: string;
  position: number;
};

type FieldType = "NORMAL" | "BOOST" | "TRAP";

type BoardField = {
  index: number;
  type: FieldType;
  value?: number;
};

type Question = {
  id: number;
  text: string;
  options: string[];
  correctIndex: number;
};

type PendingQuestion = {
  playerId: string;
  questionId: number;
};

type GameSession = {
  id: string;
  players: Player[];
  board: BoardField[];
  currentTurn: number;
  questions: Question[];
  pendingQuestion?: PendingQuestion;
  log: string[];
  winnerId?: string;
  turnEndsAt?: number;
  questionEndsAt?: number;
};

/* ------------------ Helpers ------------------ */

function createGameId(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function rollDice(): number {
  return Math.floor(Math.random() * 6) + 1;
}

function startTurnTimer(session: GameSession) {
  session.turnEndsAt = Date.now() + TURN_TIME_MS;
  session.questionEndsAt = undefined;
}

function createBoard(size: number): BoardField[] {
  return Array.from({ length: size }).map((_, i) => {
    if (i !== 0 && i % 7 === 0) {
      return { index: i, type: "BOOST", value: 3 };
    }
    if (i !== 0 && i % 5 === 0) {
      return { index: i, type: "TRAP", value: 2 };
    }
    return { index: i, type: "NORMAL" };
  });
}

/* ------------------ Question Bank ------------------ */

const QUESTION_BANK: Question[] = [
  {
    id: 1,
    text: "What is the capital of France?",
    options: ["Berlin", "Paris", "Madrid", "Rome"],
    correctIndex: 1
  },
  {
    id: 2,
    text: "2 + 2 = ?",
    options: ["3", "4", "5", "6"],
    correctIndex: 1
  },
  {
    id: 3,
    text: "Which planet is known as the Red Planet?",
    options: ["Earth", "Venus", "Mars", "Jupiter"],
    correctIndex: 2
  }
];

/* ------------------ Sessions ------------------ */

const sessions = new Map<string, GameSession>();

/* ------------------ Bootstrap ------------------ */

async function start() {
  await fastify.register(cors, {
    origin: CLIENT_ORIGIN,
    methods: ["GET", "POST"]
  });

  fastify.get("/", async () => ({ status: "ok" }));

  fastify.post("/create-game", async () => {
    const gameId = createGameId();

    sessions.set(gameId, {
      id: gameId,
      players: [],
      board: createBoard(40),
      currentTurn: 0,
      questions: QUESTION_BANK,
      log: []
    });

    return { gameId };
  });

  // ✅ CORRECT HTTP SERVER WIRING
  const httpServer = createServer((req, res) => {
    fastify.server.emit("request", req, res);
  });

  const io = new Server(httpServer, {
    cors: { origin: CLIENT_ORIGIN },
    transports: ["websocket"]
  });

  /* ------------------ Socket Logic ------------------ */

  io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);

    socket.on("join-game", ({ gameId, name }) => {
      const session = sessions.get(gameId);
      if (!session) return;

      session.players = session.players.filter(
        (p) => p.id !== socket.id
      );

      session.players.push({
        id: socket.id,
        name,
        position: 0
      });

      if (session.players.length === 2 && !session.turnEndsAt) {
        startTurnTimer(session);
      }

      socket.join(gameId);
      io.to(gameId).emit("game-state", session);
    });

    socket.on("disconnect", () => {
      sessions.forEach((session) => {
        session.players = session.players.filter(
          (p) => p.id !== socket.id
        );
        session.currentTurn = 0;
        io.to(session.id).emit("game-state", session);
      });
    });
  });

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });

  setInterval(() => {
    sessions.forEach((session) => {
      if (session.winnerId) return;
      const now = Date.now();

      if (session.turnEndsAt && now > session.turnEndsAt) {
        const player = session.players[session.currentTurn];
        if (!player) return;

        session.log.push(
          `⏱ ${player.name} skipped (turn timeout)`
        );

        session.currentTurn =
          (session.currentTurn + 1) % session.players.length;

        startTurnTimer(session);
        io.to(session.id).emit("game-state", session);
      }
    });
  }, 1000);
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
