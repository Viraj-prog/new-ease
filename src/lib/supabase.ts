import { createClient } from "@supabase/supabase-js";
import "react-native-url-polyfill/auto";

const SUPABASE_URL = "https://rvhsupzpymnyouggdqzd.supabase.co";
const SUPABASE_KEY = "sb_publishable_vNz-CKy4l-RMNJREuQu9VA__a3VlwJB";

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
