import React from 'react';

interface FollowUpQuestionsProps {
  questions: string[];
  onSelect: (question: string) => void;
}

export const FollowUpQuestions: React.FC<FollowUpQuestionsProps> = ({ questions, onSelect }) => {
  return (
    <div className="border-t p-4">
      <h3 className="mb-2 font-semibold">Follow-up questions</h3>
      <div className="flex flex-wrap gap-2">
        {questions.map((question, idx) => (
          <button
            key={idx}
            onClick={() => onSelect(question)}
            className="rounded-full bg-blue-100 px-3 py-1 text-sm text-blue-700 hover:bg-blue-200"
          >
            {question}
          </button>
        ))}
      </div>
    </div>
  );
};
