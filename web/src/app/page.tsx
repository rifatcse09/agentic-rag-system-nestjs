import FileUpload from '@/components/file-upload';

export default function UploadPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Upload Documents
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          Upload PDF or DOC files to ingest into the knowledge base. Once
          indexed, you can ask questions in the Chat tab.
        </p>
      </div>
      <FileUpload />
    </div>
  );
}
