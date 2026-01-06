type Question = {
  id: number;
  text: string;
  options: string[];
};

export default function QuestionModal({
  open,
  data,
  onAnswer
}: {
  open: boolean;
  data: {
    fieldType: "BOOST" | "TRAP";
    value: number;
    question: Question;
  } | null;
  onAnswer: (answerIndex: number) => void;
}) {
  if (!open || !data) return null;

  const { fieldType, value, question } = data;

  return (
    <div className="question-modal-overlay">
      <div className="question-modal-content">
        <h3>
          {fieldType === "BOOST"
            ? `Correct → move +${value}`
            : `Wrong → move -${value}`}
        </h3>

        <p>{question.text}</p>

        {question.options.map((opt, i) => (
          <button
            key={i}
            className="question-option-button"
            onClick={() => onAnswer(i)}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}
