// Fill these in from your Supabase project: Project Settings > API.
// Unlike the Gemini key, the anon key is *meant* to be public — Row
// Level Security (see supabase/schema.sql) is what actually protects
// data, not this key's secrecy. Safe to commit once filled in.
const SUPABASE_URL = 'https://gbuuolhtsfzsaldsprfl.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_8Q3wepYXXRAAsjPaF07i3Q_BuXZ2jjd';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
