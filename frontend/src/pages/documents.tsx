import { useState } from "react";
import { useDropzone } from "react-dropzone";
import { useIngest } from "@/hooks/use-ingest";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { UploadCloud, FileText, CheckCircle, AlertCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Documents() {
  const [documentId, setDocumentId] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const { upload, isLoading, error, result } = useIngest();

  const {
    getRootProps,
    getInputProps,
    isDragActive,
  } = useDropzone({
    maxFiles: 1,
    accept: {
      "text/plain": [".txt"],
      "application/pdf": [".pdf"],
      "text/markdown": [".md"],
      "application/json": [".json"],
    },
    onDrop: (files) => {
      if (files.length > 0) {
        setSelectedFile(files[0]);
      }
    },
  });

  const handleUpload = async () => {
    if (!documentId.trim() || !selectedFile) return;
    try {
      await upload(documentId, selectedFile);
    } catch {
      // error handled by hook
    }
  };

  const handleClear = () => {
    setDocumentId("");
    setSelectedFile(null);
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold">Documents</h2>
        <p className="text-text-secondary mt-1">
          Upload documents to the RAG system for indexing and retrieval
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Upload Document</CardTitle>
            <CardDescription>
              Documents are chunked, embedded, and stored in Qdrant
            </CardDescription>
          </CardHeader>

          <div className="space-y-5">
            <div>
              <label className="text-sm font-medium text-text-primary mb-2 block">
                Document ID
              </label>
              <Input
                placeholder="e.g., report_q3_2024"
                value={documentId}
                onChange={(e) => setDocumentId(e.target.value)}
                disabled={isLoading}
              />
            </div>

            <div
              {...getRootProps()}
              className={cn(
                "relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200",
                isDragActive
                  ? "border-accent bg-accent/5"
                  : "border-border hover:border-accent/50 hover:bg-surface-hover"
              )}
            >
              <input {...getInputProps()} disabled={isLoading} />
              {selectedFile ? (
                <div className="space-y-2">
                  <FileText className="w-10 h-10 text-accent mx-auto" />
                  <p className="text-sm font-medium text-text-primary">
                    {selectedFile.name}
                  </p>
                  <p className="text-xs text-text-secondary">
                    {(selectedFile.size / 1024).toFixed(1)} KB
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <UploadCloud className="w-10 h-10 text-text-muted mx-auto" />
                  <p className="text-sm text-text-secondary">
                    {isDragActive
                      ? "Drop your file here"
                      : "Drag & drop a file, or click to browse"}
                  </p>
                  <p className="text-xs text-text-muted">
                    TXT, PDF, MD, JSON (max 10MB)
                  </p>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <Button
                onClick={handleUpload}
                loading={isLoading}
                disabled={!documentId.trim() || !selectedFile}
                className="flex-1"
              >
                <UploadCloud className="w-4 h-4 mr-2" />
                Upload & Index
              </Button>
              <Button
                variant="ghost"
                onClick={handleClear}
                disabled={isLoading}
              >
                <X className="w-4 h-4 mr-1" />
                Clear
              </Button>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Upload Result</CardTitle>
            <CardDescription>Status of the last upload operation</CardDescription>
          </CardHeader>

          {error && (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-error/5 border border-error/20">
              <AlertCircle className="w-5 h-5 text-error mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-error text-sm">Upload failed</p>
                <p className="text-xs text-text-secondary mt-0.5">{error}</p>
              </div>
            </div>
          )}

          {result && (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-success/5 border border-success/20">
              <CheckCircle className="w-5 h-5 text-success mt-0.5 flex-shrink-0" />
              <div className="space-y-2 w-full">
                <p className="font-medium text-success text-sm">
                  Indexed successfully
                </p>
                <div className="flex items-center gap-3">
                  <div className="px-3 py-1.5 rounded-lg bg-surface-hover text-xs">
                    <span className="text-text-muted">Document: </span>
                    <span className="text-text-primary font-medium">
                      {result.document_id}
                    </span>
                  </div>
                  <Badge variant="success">{result.chunks_indexed} chunks</Badge>
                </div>
              </div>
            </div>
          )}

          {!error && !result && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FileText className="w-12 h-12 text-text-muted mb-3" />
              <p className="text-sm text-text-secondary">No uploads yet</p>
              <p className="text-xs text-text-muted mt-1">
                Upload a document to see results here
              </p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
