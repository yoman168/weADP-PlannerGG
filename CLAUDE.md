# CLAUDE.md

## Server health check

After making changes, always verify the dev server responds:

```bash
curl -s -m 5 -o /dev/null -w "%{http_code}" http://localhost:3000/we-adk
```

If it returns `000` (timeout) or `500`:

1. Kill all processes: `lsof -ti:3000 | xargs kill -9 2>/dev/null; pkill -9 -f "claude --print" 2>/dev/null`
2. Clear cache: `rm -rf .next`
3. Restart: `npx next dev --hostname 0.0.0.0 --port 3000`
4. Wait 8 seconds, then check again
5. If still failing, check for TypeScript errors: `npx tsc --noEmit 2>&1 | grep "error TS" | grep -v node_modules`

Common causes of hangs:
- Stale `.next` cache — always `rm -rf .next` before restart
- Orphan `claude --print` processes from AI chat — kill with `pkill -9 -f "claude --print"`
- Context providers wrapping server components in `layout.tsx` — keep client providers inside client components only

## Project structure

- `src/app/api/` — API routes (restored from `src/app/_api/` for dev mode)
- `src/app/_api/` — backup of API routes (used for static export builds)
- `next.config.ts` — `output: 'export'` only in production, skipped in dev
- Toast: use `showToast()` or `useToast()` from `@/components/ui/toast` — no provider wrapping needed
