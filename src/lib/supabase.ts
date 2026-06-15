import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://etjbbrkrtbckvqftqhmz.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0amJicmtydGJja3ZxZnRxaG16Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1MjIyMzQsImV4cCI6MjA5NzA5ODIzNH0.4vpDixgXCkVmvShnRnpsIeA42pUkqscyKPxC2KS-Zd0'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
