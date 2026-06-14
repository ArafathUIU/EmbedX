import { useState, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import { useIngest } from "@/hooks/use-ingest";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Upload, FileText, Check, AlertTriangle, X, Trash2, RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchDocuments, deleteDocument, type DocumentSummary } from "@/api/client";

export default function Documents() {
  const [documentId, setDocumentId] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const { upload, isLoading, error, result } = useIngest();
  const [docs, setDocs] = useState<DocumentSummary[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    if (result) {
      sessionStorage.setItem("embedx_last_doc", result.document_id);
    }
  }, [result]);

  const loadDocs = async () => {
    setDocsLoading(true);
    try {
      const data = await fetchDocuments();
      setDocs(data.documents);
    } catch {
      // silently fail
    } finally {
      setDocsLoading(false);
    }
  };

  useEffect(() => { loadDocs(); }, []);

  useEffect(() => {
    if (result) loadDocs();
  }, [result]);

  const handleDelete = async (did: string) => {
    setDeleting(did);
    try {
      await deleteDocument(did);
      setDocs((prev) => prev.filter((d) => d.document_id !== did));
    } catch {
      // silently fail
    } finally {
      setDeleting(null);
    }
  };

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
      if (files.length > 0) setSelectedFile(files[0]);
    },
  });

  const handleUpload = async () => {
    if (!documentId.trim() || !selectedFile) return;
    try { await upload(documentId, selectedFile); } catch {}
  };

  const handleClear = () => {
    setDocumentId("");
    setSelectedFile(null);
  };

  return (
    <div className="space-y-8 animate-fade-in-up">
      <div>
        <h2 className="font-display text-2xl font-bold tracking-tight text-bone">
          Documents
        </h2>
        <p className="font-mono text-xs text-bone-dim tracking-wide uppercase mt-2">
          Ingest &middot; Chunk &middot; Embed &middot; Index
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-px bg-border">
        <div className="bg-void p-6">
          <div className="mb-6">
            <h3 className="font-display font-semibold text-bone text-base tracking-tight">
              Upload
            </h3>
            <p className="text-xs text-bone-muted mt-1.5 font-body">
              Documents are chunked, embedded, and stored in Qdrant
            </p>
          </div>

          <div className="space-y-5">
            <div>
              <label className="font-mono text-[10px] text-bone-dim tracking-widest uppercase mb-2 block">
                Document ID
              </label>
              <Input
                placeholder="report_q3_2024"
                value={documentId}
                onChange={(e) => setDocumentId(e.target.value)}
                disabled={isLoading}
              />
            </div>

            <div
              {...getRootProps()}
              className={cn(
                "relative border border-dashed p-8 text-center cursor-pointer transition-all duration-200",
                isDragActive
                  ? "border-violet/60 bg-violet/5"
                  : "border-border hover:border-border-active hover:bg-surface-elevated"
              )}
            >
              <input {...getInputProps()} disabled={isLoading} />
              {selectedFile ? (
                <div className="space-y-2">
                  <FileText className="w-8 h-8 text-violet-bright mx-auto" />
                  <p className="font-display text-sm font-medium text-bone">
                    {selectedFile.name}
                  </p>
                  <p className="font-mono text-[11px] text-bone-dim">
                    {(selectedFile.size / 1024).toFixed(1)} KB
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Upload className="w-8 h-8 text-bone-dim mx-auto" />
                  <p className="text-sm text-bone-muted font-body">
                    {isDragActive ? "Drop your file" : "Drag a file or click to browse"}
                  </p>
                  <p className="font-mono text-[10px] text-bone-dim tracking-wide uppercase">
                    TXT &middot; PDF &middot; MD &middot; JSON
                  </p>
                </div>
              )}
            </div>

            <div className="flex gap-px bg-border">
              <Button
                onClick={handleUpload}
                loading={isLoading}
                disabled={!documentId.trim() || !selectedFile}
                variant="default"
                size="lg"
                className="flex-1"
              >
                <Upload className="w-4 h-4 mr-2" />
                Index
              </Button>
              <Button
                variant="ghost"
                size="lg"
                onClick={handleClear}
                disabled={isLoading}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        <div className="bg-void p-6">
          <div className="mb-6">
            <h3 className="font-display font-semibold text-bone text-base tracking-tight">
              Result
            </h3>
            <p className="text-xs text-bone-muted mt-1.5 font-body">
              Status of the last upload operation
            </p>
          </div>

          {error && (
            <div className="flex items-start gap-3 p-4 bg-heat/5 border border-heat/30">
              <AlertTriangle className="w-4 h-4 text-heat mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-display font-semibold text-heat text-sm">Upload Failed</p>
                <p className="font-mono text-[11px] text-bone-dim mt-0.5">{error}</p>
              </div>
            </div>
          )}

          {result && (
            <div className="p-4 bg-mint/5 border border-mint/20 space-y-3">
              <div className="flex items-start gap-3">
                <Check className="w-4 h-4 text-mint mt-0.5 flex-shrink-0" />
                <p className="font-display font-semibold text-mint text-sm">Indexed</p>
              </div>
              <div className="flex items-center gap-3 pl-7">
                <div className="px-3 py-1.5 bg-surface-elevated font-mono text-[11px]">
                  <span className="text-bone-dim">ID </span>
                  <span className="text-bone">{result.document_id}</span>
                </div>
                <Badge variant="mint">{result.chunks_indexed} chunks</Badge>
              </div>
            </div>
          )}

          {!error && !result && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <FileText className="w-10 h-10 text-bone-dim mb-3 opacity-30" />
              <p className="text-sm text-bone-dim font-body">No uploads yet</p>
            </div>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Indexed Documents</CardTitle>
            <button
              onClick={loadDocs}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-border bg-surface-elevated font-mono text-[10px] text-bone-dim hover:text-bone hover:border-border-active transition-colors cursor-pointer tracking-wide uppercase"
            >
              <RefreshCw className={`w-3 h-3 ${docsLoading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </CardHeader>
        <div className="px-6 pb-6">
          {docs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <FileText className="w-10 h-10 text-bone-dim mb-3 opacity-30" />
              <p className="text-sm text-bone-dim font-body">No documents indexed yet</p>
            </div>
          ) : (
            <div className="space-y-px">
              {docs.map((doc) => (
                <div
                  key={doc.document_id}
                  className="flex items-center gap-4 px-4 py-3 bg-surface-elevated group hover:bg-surface transition-colors"
                >
                  <FileText className="w-4 h-4 text-violet-bright flex-shrink-0" />
                  <code className="font-mono text-xs text-bone tracking-tight flex-1">
                    {doc.document_id}
                  </code>
                  <Badge variant="ghost">{doc.chunk_count} chunks</Badge>
                  <button
                    onClick={() => handleDelete(doc.document_id)}
                    disabled={deleting === doc.document_id}
                    className="p-1.5 text-bone-dim hover:text-heat transition-colors opacity-0 group-hover:opacity-100 cursor-pointer disabled:opacity-30"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
