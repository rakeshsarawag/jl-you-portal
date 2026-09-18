// Edge Function Entry Point for Supabase
// This file serves as the proper entry point for the make-server edge function

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import app from "../server/index.tsx";

// Serve the Hono app
serve(app.fetch);