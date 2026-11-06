import { isAuthorizedInternalRequest } from "./shared/internal-dispatch";
import {
  isValidPostprocessJob,
  runSynthesisPostprocess,
} from "./shared/synthesis-postprocess";
import { createSynthesisPostprocessDeps } from "./shared/synthesis-postprocess-deps";

/**
 * Background function (15-min budget): post-processing for one synthesis
 * turn — consciousness analysis, advice extraction, Atman persistence and the
 * rolling chat summary (written to users/{uid}/chats/{chatId}.summary).
 * Internal-only: dispatched by /api/synthesis with the internal secret.
 */
export default async (req: Request) => {
  if (req.method !== "POST" || !isAuthorizedInternalRequest(req)) {
    return new Response("Forbidden", { status: 403 });
  }
  let job: unknown;
  try {
    job = await req.json();
  } catch {
    return new Response("Bad Request", { status: 400 });
  }
  if (!isValidPostprocessJob(job)) {
    return new Response("Bad Request", { status: 400 });
  }
  const result = await runSynthesisPostprocess(
    job,
    createSynthesisPostprocessDeps(),
  );
  console.info(
    `[SynthesisPostprocess] brainUpdated=${result.brainUpdated} summaryWritten=${result.summaryWritten}${result.skipped ? ` skipped=${result.skipped}` : ""}`,
  );
  return new Response(null, { status: 202 });
};
