import { useEffect, useState } from "react";
import { socket } from "./socket";
import Board from "./Board";
import QuestionModal from "./QuestionModal";
import { getPlayerId } from "./playerId";


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
  const playerId = getPlayerId();
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
    socket.emit("join-game", { gameId, name, playerId });
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
    socket.emit("join-game", { gameId, name, playerId });
  }

  return () => {
    socket.off("connect", onConnect);
    socket.off("game-state");
    socket.off("question");
  };
}, [gameId, name, playerId]);

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


  if (!game) return <div className="loading">Loading game...</div>;

  const myTurn =
    game.players[game.currentTurn]?.id === playerId;

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
    <div className="lobby-container">
      <h2>Quiz Board Game</h2>
	  
	  <div className="lobby-info">
        <p>
          <strong>Lobby ID:</strong>{" "}
          <code>{game.id}</code>
        </p>

        <p>
          <strong>Current turn:</strong>{" "}
          {activePlayer?.name}
        </p>
	  
        {turnTimeLeft !== null && (
          <p className="timer">⏱ Turn ends in: {turnTimeLeft}s</p>
        )}

        {questionTimeLeft !== null && (
          <p className="timer">⏱ Answer time left: {questionTimeLeft}s</p>
        )}
      </div>

      <div className="players-list">
        <h3>Players</h3>
        <div className="players-grid">
          {game.players.map((player, index) => (
            <div key={player.id} className="player-item">
              <div className={`player-token player-color-${index % 6}`} />
              <span className={player.id === playerId ? "current-player" : ""}>
                {player.name} {player.id === playerId && "(You)"}
              </span>
            </div>
          ))}
        </div>
      </div>

      <Board
        board={game.board}
        players={game.players}
      />
	  
	  {isGameOver && (
        <div className="winner-banner">
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
          className="game-button"
          onClick={() =>
            socket.emit("restart-game", { gameId })
          }
        >
          🔄 Restart Game
        </button>
      )}

      {myTurn && !question && !isGameOver && (
        <button
          className="game-button"
          disabled={notEnoughPlayers}
          onClick={() =>
            socket.emit("roll-dice", { gameId })
          }
        >
          🎲 Roll Dice
        </button>
      )}

      {notEnoughPlayers && (
        <p className="waiting-message">
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

      <div className="game-log">
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
