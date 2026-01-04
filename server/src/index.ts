import Fastify from "fastify";
import cors from "@fastify/cors";
import { Server } from "socket.io";
import { createServer } from "http";


const httpServer = createServer(fastify.server);
const fastify = Fastify();
const PORT = Number(process.env.PORT) || 3001;
const CLIENT_ORIGIN =
  process.env.CLIENT_ORIGIN || "*";


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

/* ------------------ Server Setup ------------------ */

const sessions = new Map<string, GameSession>();

/* ---------------- Bootstrap ---------------- */

async function start() {
  await fastify.register(cors, {
    origin: CLIENT_ORIGIN
  });

  fastify.get("/", async () => {
    return { status: "ok" };
  });

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

  const io = new Server(httpServer, {
    cors: { origin: CLIENT_ORIGIN }
  });

/* ------------------ Socket Logic ------------------ */

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  socket.on("join-game", ({ gameId, name }) => {
    const session = sessions.get(gameId);
    if (!session) return;

    // Prevent duplicate joins (React StrictMode safe)
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
  socket.on("restart-game", ({ gameId }) => {
  const session = sessions.get(gameId);
  if (!session) return;

  // Only allow restart if game ended
  if (!session.winnerId) return;

  session.players.forEach((p) => {
    p.position = 0;
  });

  session.currentTurn = 0;
  session.winnerId = undefined;
  session.pendingQuestion = undefined;
  session.log = ["🔄 Game restarted"];

  startTurnTimer(session);
  io.to(gameId).emit("game-state", session);
});

  socket.on("roll-dice", ({ gameId }) => {
  const session = sessions.get(gameId);
  if (!session) return;

  // 🚫 Game already finished
  if (session.winnerId) return;

  // 🚫 Need at least 2 players
  if (session.players.length < 2) return;

  // ⏱ Turn expired
  if (
    session.turnEndsAt &&
    Date.now() > session.turnEndsAt
  ) {
    return;
  }

  const player = session.players[session.currentTurn];
  if (!player || player.id !== socket.id) return;

  const roll = rollDice();
  player.position += roll;

  session.log.push(
    `${player.name} rolled ${roll} → position ${player.position}`
  );

  /* 🏁 WIN CHECK */
  if (player.position >= session.board.length - 1) {
    player.position = session.board.length - 1;
    session.winnerId = player.id;

    session.turnEndsAt = undefined;
    session.questionEndsAt = undefined;
    session.pendingQuestion = undefined;

    session.log.push(
      `🏆 ${player.name} has won the game!`
    );

    io.to(gameId).emit("game-state", session);
    return;
  }

  const field = session.board[player.position];

  /* ❓ QUESTION REQUIRED */
  if (field && field.type !== "NORMAL") {
    const question =
      session.questions[
        Math.floor(Math.random() * session.questions.length)
      ];

    session.pendingQuestion = {
      playerId: player.id,
      questionId: question.id
    };

    session.questionEndsAt =
      Date.now() + QUESTION_TIME_MS;
    session.turnEndsAt = undefined;

    socket.emit("question", {
      fieldType: field.type,
      value: field.value,
      question: {
        id: question.id,
        text: question.text,
        options: question.options
      }
    });

    io.to(gameId).emit("game-state", session);
    return;
  }

  /* ➡️ NORMAL FIELD → NEXT TURN */
  session.currentTurn =
    (session.currentTurn + 1) %
    session.players.length;

  startTurnTimer(session);
  io.to(gameId).emit("game-state", session);
});



  socket.on(
  "answer-question",
  ({ gameId, questionId, answerIndex }) => {
    const session = sessions.get(gameId);
    if (!session || !session.pendingQuestion) return;

    // ⏱ Question expired
    if (
      session.questionEndsAt &&
      Date.now() > session.questionEndsAt
    ) {
      return;
    }

    const pending = session.pendingQuestion;
    if (pending.playerId !== socket.id) return;
    if (pending.questionId !== questionId) return;

    const question = session.questions.find(
      (q) => q.id === questionId
    );
    if (!question) return;

    const player = session.players.find(
      (p) => p.id === socket.id
    );
    if (!player) return;

    const field = session.board[player.position];
    const correct =
      answerIndex === question.correctIndex;

    /* 🧠 APPLY FIELD EFFECT */
    if (field.type === "BOOST" && correct) {
      player.position += field.value!;
      session.log.push(
        `${player.name} answered correctly → BOOST +${field.value}`
      );
    }

    if (field.type === "TRAP" && !correct) {
      player.position -= field.value!;
      if (player.position < 0) player.position = 0;

      session.log.push(
        `${player.name} answered incorrectly → TRAP -${field.value}`
      );
    }

    /* 🏁 WIN CHECK */
    if (player.position >= session.board.length - 1) {
      player.position = session.board.length - 1;
      session.winnerId = player.id;

      session.pendingQuestion = undefined;
      session.questionEndsAt = undefined;
      session.turnEndsAt = undefined;

      session.log.push(
        `🏆 ${player.name} has won the game!`
      );

      io.to(gameId).emit("game-state", session);
      return;
    }

    /* ➡️ NEXT TURN */
    session.pendingQuestion = undefined;
    session.questionEndsAt = undefined;

    session.currentTurn =
      (session.currentTurn + 1) %
      session.players.length;

    startTurnTimer(session);
    io.to(gameId).emit("game-state", session);
  }
);


  socket.on("disconnect", () => {
    sessions.forEach((session) => {
      const index = session.players.findIndex(
        (p) => p.id === socket.id
      );

      if (index !== -1) {
        session.players.splice(index, 1);
        session.currentTurn = 0;
        io.to(session.id).emit("game-state", session);
      }
    });
  });
});

/* ------------------ Start Server ------------------ */

  await fastify.listen({
  port: PORT,
  host: "0.0.0.0"
});
  console.log(`Server running on http://localhost:${PORT}`);
  
  setInterval(() => {
  sessions.forEach((session) => {
    if (session.winnerId) return;

    const now = Date.now();

    /* ⏱ TURN TIMEOUT */
    if (
      session.turnEndsAt &&
      now > session.turnEndsAt
    ) {
      const player =
        session.players[session.currentTurn];

      session.log.push(
        `⏱ ${player.name} skipped (turn timeout)`
      );

      session.currentTurn =
        (session.currentTurn + 1) %
        session.players.length;

      startTurnTimer(session);
      io.to(session.id).emit("game-state", session);
    }

    /* ⏱ QUESTION TIMEOUT */
    if (
      session.questionEndsAt &&
      now > session.questionEndsAt &&
      session.pendingQuestion
    ) {
      const player = session.players.find(
        (p) => p.id === session.pendingQuestion!.playerId
      );

      if (player) {
        const field = session.board[player.position];

        if (field.type === "TRAP") {
          player.position -= field.value!;
          if (player.position < 0) player.position = 0;
        }

        session.log.push(
          `⏱ ${player.name} failed to answer in time`
        );
      }

      session.pendingQuestion = undefined;
      session.questionEndsAt = undefined;

      session.currentTurn =
        (session.currentTurn + 1) %
        session.players.length;

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
