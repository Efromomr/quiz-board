import Database from "better-sqlite3";
import { join } from "path";

// Determine database path - use src directory in dev, go up one level in production
// In dev: __dirname = server/src, so questions.db is at server/src/questions.db
// In prod: __dirname = server/dist, so we go up to server and then to src
const dbPath = __filename.includes("dist")
  ? join(__dirname, "..", "src", "questions.db")
  : join(__dirname, "questions.db");

const db = new Database(dbPath);

// Initialize database schema and data
export function initializeDatabase() {
  // Create table if it doesn't exist
  db.exec(`
    CREATE TABLE IF NOT EXISTS questions (
      id INTEGER PRIMARY KEY,
      text TEXT,
      options TEXT,
      correctIndex INTEGER
    );
  `);

  // Check if questions already exist
  const count = db.prepare("SELECT COUNT(*) as count FROM questions").get() as { count: number };
  
  if (count.count === 0) {
    // Insert initial questions
    const insert = db.prepare(`
      INSERT INTO questions (id, text, options, correctIndex)
      VALUES (?, ?, ?, ?)
    `);

    const questions = [
      [1, "What is the capital of France?", '["Berlin", "Paris", "Madrid", "Rome"]', 1],
      [2, "2 + 2 = ?", '["3", "4", "5", "6"]', 1],
      [3, "Which planet is known as the Red Planet?", '["Earth", "Venus", "Mars", "Jupiter"]', 2]
    ];

    const insertMany = db.transaction((questions) => {
      for (const question of questions) {
        insert.run(question);
      }
    });

    insertMany(questions);
    console.log("Database initialized with questions");
  }
}

// Get all questions from database
export function getAllQuestions() {
  const rows = db.prepare("SELECT * FROM questions").all() as Array<{
    id: number;
    text: string;
    options: string;
    correctIndex: number;
  }>;

  return rows.map((row) => ({
    id: row.id,
    text: row.text,
    options: JSON.parse(row.options) as string[],
    correctIndex: row.correctIndex
  }));
}

// Get a question by ID
export function getQuestionById(id: number) {
  const row = db.prepare("SELECT * FROM questions WHERE id = ?").get(id) as {
    id: number;
    text: string;
    options: string;
    correctIndex: number;
  } | undefined;

  if (!row) return null;

  return {
    id: row.id,
    text: row.text,
    options: JSON.parse(row.options) as string[],
    correctIndex: row.correctIndex
  };
}
