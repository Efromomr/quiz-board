import { useEffect, useState } from "react";
import { socket } from "./socket";
import Board from "./Board";
import QuestionModal from "./QuestionModal";


type Player = {
  id: string;
  name: string;
  position: number;
};

type BoardField = {
  index: number;
  type: "NORMAL" | "BOOST" | "TRAP";
  value?: number;
};

type Question = {
  id: number;
  text: string;
  options: string[];
};

type GameState = {
  id: string;
  players: Player[];
  board: BoardField[];
  currentTurn: number;
  log: string[];
  winnerId?: string;
  turnEndsAt?: number;
  questionEndsAt?: number;
};


export default function Lobby({
  gameId,
  name
}: {
  gameId: string;
  name: string;
}) {
  const [game, setGame] = useState<GameState | null>(null);
  const [question, setQuestion] = useState<{
    fieldType: "BOOST" | "TRAP";
    value: number;
    question: Question;
  } | null>(null);
  const [now, setNow] = useState(Date.now());

  // Update time every second to refresh countdown
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
  const onConnect = () => {
    socket.emit("join-game", { gameId, name });
  };

  socket.on("connect", onConnect);

  socket.on("game-state", (state: GameState) => {
    setGame(state);
    // Clear question if questionEndsAt is not set or has passed
    if (!state.questionEndsAt || state.questionEndsAt < Date.now()) {
      setQuestion(null);
    }
  });

  socket.on("question", (q) => {
    setQuestion(q);
  });

  // If socket is already connected, emit join-game immediately
  if (socket.connected) {
    socket.emit("join-game", { gameId, name });
  }

  return () => {
    socket.off("connect", onConnect);
    socket.off("game-state");
    socket.off("question");
  };
}, [gameId, name]);

  // Clear question when time expires
  useEffect(() => {
    if (!game || !question) return;

    const checkTimeout = () => {
      const currentTime = Date.now();
      
      // Clear question if question time has expired
      if (game.questionEndsAt && currentTime >= game.questionEndsAt) {
        setQuestion(null);
        return;
      }

      // Clear question if turn time has expired (and there's a question)
      if (game.turnEndsAt && currentTime >= game.turnEndsAt) {
        setQuestion(null);
        return;
      }
    };

    checkTimeout();
    // Check every 100ms for more responsive timeout handling
    const interval = setInterval(checkTimeout, 100);

    return () => clearInterval(interval);
  }, [game, question, now]);


  if (!game) return <p>Loading game...</p>;

  const myTurn =
    game.players[game.currentTurn]?.id === socket.id;

  const activePlayer =
    game.players[game.currentTurn];
	
  const isGameOver = !!game.winnerId;
  const notEnoughPlayers = game.players.length < 2;
  
  const turnTimeLeft = game.turnEndsAt
  ? Math.max(0, Math.ceil((game.turnEndsAt - now) / 1000))
  : null;

  const questionTimeLeft = game.questionEndsAt
  ? Math.max(0, Math.ceil((game.questionEndsAt - now) / 1000))
  : null;


  return (
    <div style={{ padding: 24 }}>
      <h2>Quiz Board Game</h2>
	  
	  <p>
        <strong>Lobby ID:</strong>{" "}
        <code>{game.id}</code>
      </p>


      <p>
        <strong>Current turn:</strong>{" "}
        {activePlayer?.name}
      </p>
	  
	  {turnTimeLeft !== null && (
  <p>⏱ Turn ends in: {turnTimeLeft}s</p>
)}

{questionTimeLeft !== null && (
  <p>⏱ Answer time left: {questionTimeLeft}s</p>
)}


      <Board
        board={game.board}
        players={game.players}
      />
	  
	  {isGameOver && (
  <div
    style={{
      marginTop: 24,
      padding: 16,
      background: "#d4edda",
      border: "1px solid #c3e6cb"
    }}
  >
    <h2>
      🏆 Winner:{" "}
      {
        game.players.find(
          (p) => p.id === game.winnerId
        )?.name
      }
    </h2>
    <p>The game is finished.</p>
  </div>

)}

{isGameOver && (
  <button
    style={{ marginTop: 12 }}
    onClick={() =>
      socket.emit("restart-game", { gameId })
    }
  >
    🔄 Restart Game
  </button>
)}


      {myTurn && !question && !isGameOver && (
  <button
    style={{ marginTop: 16, padding: 10 }}
    disabled={notEnoughPlayers}
    onClick={() =>
      socket.emit("roll-dice", { gameId })
    }
  >
    🎲 Roll Dice
  </button>
)}

{notEnoughPlayers && (
  <p style={{ color: "gray" }}>
    Waiting for at least one more player...
  </p>
)}


      <QuestionModal
        open={!!question}
        data={question}
        onAnswer={(answerIndex) => {
          socket.emit("answer-question", {
            gameId,
            questionId: question!.question.id,
            answerIndex
          });
          setQuestion(null);
        }}
      />

      <div style={{ marginTop: 24 }}>
        <h3>Game Log</h3>
        <ul>
          {game.log.map((entry, i) => (
            <li key={i}>{entry}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
