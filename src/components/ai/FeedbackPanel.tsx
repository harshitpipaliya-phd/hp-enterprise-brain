import React from 'react';

interface FeedbackPanelProps {
  executionId: string;
  onSubmit: (rating: string, feedback?: string) => void;
}

export const FeedbackPanel: React.FC<FeedbackPanelProps> = ({ onSubmit }) => {
  const [rating, setRating] = React.useState<string>('');
  const [feedback, setFeedback] = React.useState('');

  const handleSubmit = () => {
    if (!rating) return;
    onSubmit(rating, feedback);
    setRating('');
    setFeedback('');
  };

  return (
    <div className="border-t p-4">
      <h3 className="mb-2 font-semibold">Was this response helpful?</h3>
      <div className="mb-2 flex gap-2">
        <button onClick={() => setRating('positive')} className={`rounded p-2 ${rating === 'positive' ? 'bg-green-500 text-white' : 'bg-gray-200'}`}>
          👍
        </button>
        <button onClick={() => setRating('negative')} className={`rounded p-2 ${rating === 'negative' ? 'bg-red-500 text-white' : 'bg-gray-200'}`}>
          👎
        </button>
      </div>
      <textarea
        value={feedback}
        onChange={(e) => setFeedback(e.target.value)}
        className="w-full rounded border p-2"
        placeholder="Additional feedback..."
      />
      <button onClick={handleSubmit} className="mt-2 rounded bg-blue-600 px-4 py-2 text-white">
        Submit Feedback
      </button>
    </div>
  );
};
