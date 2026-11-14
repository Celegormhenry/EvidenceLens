declare namespace Cloudflare {
  interface Env {
    TELEM_API_KEY?: string;
    OPENAI_API_KEY?: string;
    NEO4J_URI?: string;
    NEO4J_USERNAME?: string;
    NEO4J_PASSWORD?: string;
    NEO4J_DATABASE?: string;
    NEO4J_NAMESPACE?: string;
    DB?: D1Database;
    BUCKET?: R2Bucket;
  }
}
