-- Atomic delta-merge for progress counters. The client is authoritative
-- between syncs; deltas add up server-side so two devices never clobber
-- each other (no last-write-wins on absolute values).

create or replace function public.increment_progress(
  p_question_id text,
  p_shown_delta integer,
  p_wrong_delta integer,
  p_correct_delta integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if p_shown_delta < 0 or p_wrong_delta < 0 or p_correct_delta < 0
     or p_shown_delta > 1000 or p_wrong_delta > 1000 or p_correct_delta > 1000 then
    raise exception 'delta out of range';
  end if;

  insert into public.user_progress
    (user_id, question_id, times_shown, times_wrong, times_correct, last_seen_at, last_result)
  values
    (auth.uid(), p_question_id, p_shown_delta, p_wrong_delta, p_correct_delta, now(), p_correct_delta > 0)
  on conflict (user_id, question_id) do update set
    times_shown   = user_progress.times_shown   + excluded.times_shown,
    times_wrong   = user_progress.times_wrong   + excluded.times_wrong,
    times_correct = user_progress.times_correct + excluded.times_correct,
    last_seen_at  = now(),
    last_result   = excluded.last_result;
end;
$$;

-- Batch variant: sync a whole session in one round-trip.
-- p_deltas: [{"question_id":"flag:DE","shown":1,"wrong":0,"correct":1}, ...]
create or replace function public.sync_progress(p_deltas jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  d jsonb;
  n integer := 0;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if jsonb_array_length(p_deltas) > 500 then
    raise exception 'too many deltas';
  end if;

  for d in select * from jsonb_array_elements(p_deltas) loop
    perform public.increment_progress(
      d->>'question_id',
      coalesce((d->>'shown')::integer, 0),
      coalesce((d->>'wrong')::integer, 0),
      coalesce((d->>'correct')::integer, 0)
    );
    n := n + 1;
  end loop;
  return n;
end;
$$;

revoke execute on function public.increment_progress from anon;
revoke execute on function public.sync_progress from anon;
grant execute on function public.increment_progress to authenticated;
grant execute on function public.sync_progress to authenticated;
