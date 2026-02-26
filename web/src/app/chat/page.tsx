import ChatInterface from '@/components/chat-interface';

export default function ChatPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Ask Questions
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          Ask anything about the documents you&apos;ve uploaded. Answers are
          grounded in your indexed content.
        </p>
      </div>
      <ChatInterface />
    </div>
  );
}
