#!/bin/bash

echo "Repairing old remote timestamps..."
npx supabase migration repair --status reverted 20260330043719 20260330055348 20260330170227 20260330191117 20260330202506 20260401093130 20260401114253 20260401114328 20260401120139 20260401123735 20260409200332

echo "Marking your renamed local migrations as applied so they don't rerun..."
npx supabase migration repair --status applied 001 002 003 004 005 006 007 008 009 010 011 012 013 014 015 016 017 018 019 020 021

echo "Pushing the new Content Consumption migration cleanly..."
npx supabase db push
