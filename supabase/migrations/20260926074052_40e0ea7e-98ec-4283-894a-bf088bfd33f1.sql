ALTER TABLE public.rita_voice_settings
  ADD COLUMN IF NOT EXISTS german_fish_voice_id text NOT NULL DEFAULT '3235abc9a84b407d92f73539a5651720';

UPDATE public.rita_voice_settings
SET voice_engine = 'fish',
    fish_voice_id = '5814f46c02f5486d9c72b31bd82217ba',
    german_fish_voice_id = '3235abc9a84b407d92f73539a5651720',
    second_pass_stt = false
WHERE id = true;