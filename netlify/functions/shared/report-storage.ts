export interface ReportStoragePathInput {
  uid: string;
  reportId: string;
  filename: string;
}

export interface ReportBucketLike {
  file(path: string): {
    save(data: Buffer, options: Record<string, unknown>): Promise<void>;
    download(): Promise<[Buffer]>;
  };
}

export function createReportStoragePath(input: ReportStoragePathInput) {
  return [
    "users",
    safeSegment(input.uid),
    "reports",
    safeSegment(input.reportId),
    safeSegment(input.filename),
  ].join("/");
}

export async function saveReportPdf(input: {
  bucket: ReportBucketLike;
  path: string;
  pdf: ArrayBuffer | Buffer;
  metadata?: Record<string, string>;
}) {
  await input.bucket.file(input.path).save(toBuffer(input.pdf), {
    resumable: false,
    metadata: {
      contentType: "application/pdf",
      metadata: input.metadata || {},
    },
  });
}

export async function downloadReportPdf(input: {
  bucket: ReportBucketLike;
  path: string;
}) {
  const [buffer] = await input.bucket.file(input.path).download();
  return buffer;
}

function toBuffer(value: ArrayBuffer | Buffer) {
  if (Buffer.isBuffer(value)) return value;
  return Buffer.from(value);
}

function safeSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9_.-]/g, "_").slice(0, 160);
}
