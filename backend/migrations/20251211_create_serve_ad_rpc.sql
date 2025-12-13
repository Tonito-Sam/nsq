-- Atomic RPC to serve an ad: selects an eligible campaign, enforces per-user daily cap,
-- records an impression, and updates campaign.spent_usd in a single transaction.
CREATE OR REPLACE FUNCTION public.serve_ad_atomic(
  p_user_id uuid,
  p_country text,
  p_age int,
  p_interests text[]
) RETURNS jsonb
LANGUAGE plpgsql AS $$
DECLARE
  cand RECORD;
  per_user_daily int;
  user_imps int;
  cost_per_imp numeric := 0.001;
  inserted_imp jsonb;
  updated_camp jsonb;
BEGIN
  -- Iterate active campaigns ordered by remaining budget
  FOR cand IN
    SELECT * FROM public.campaigns
    WHERE status = 'active' AND (COALESCE(budget_usd,0) - COALESCE(spent_usd,0)) > 0
    ORDER BY (COALESCE(budget_usd,0) - COALESCE(spent_usd,0)) DESC
  LOOP
    -- Basic targeting checks (all_countries or country in countries list)
    IF cand.target_options IS NOT NULL THEN
      BEGIN
        IF (cand.target_options->>'all_countries')::text = 'true' THEN
          -- allowed
        ELSIF cand.target_options ? 'countries' THEN
          IF NOT (p_country IS NOT NULL AND (cand.target_options->'countries') ? p_country) THEN
            CONTINUE; -- skip this candidate
          END IF;
        END IF;
      EXCEPTION WHEN others THEN
        -- ignore parsing errors and treat as no targeting
        NULL;
      END;
    END IF;

    -- Frequency cap: default 1 per day unless campaign has override
    per_user_daily := 1;
    IF cand.target_options IS NOT NULL AND (cand.target_options->'frequency_cap') IS NOT NULL THEN
      BEGIN
        per_user_daily := COALESCE(((cand.target_options->'frequency_cap')->>'per_user_daily')::int, 1);
      EXCEPTION WHEN others THEN
        per_user_daily := 1;
      END;
    END IF;

    IF p_user_id IS NOT NULL THEN
      SELECT COUNT(*) INTO user_imps FROM public.ad_impressions WHERE campaign_id = cand.id AND user_id = p_user_id AND served_at >= date_trunc('day', now());
      IF user_imps >= per_user_daily THEN
        CONTINUE; -- user reached cap for this campaign
      END IF;
    END IF;

    -- Determine cost per impression based on objective
    IF cand.objective = 'boost_post' THEN
      cost_per_imp := 0.0005;
    ELSE
      cost_per_imp := 0.001;
    END IF;

    -- Insert ad_impression and update campaign atomically
    INSERT INTO public.ad_impressions (campaign_id, user_id, post_id, cost_usd, served_at, meta, created_at)
    VALUES (cand.id, p_user_id, cand.post_id, cost_per_imp, now(), jsonb_build_object('served_by','serve_ad_atomic'), now())
    RETURNING to_jsonb(public.ad_impressions.*) INTO inserted_imp;

    UPDATE public.campaigns
    SET spent_usd = COALESCE(spent_usd,0) + cost_per_imp,
        updated_at = now()
    WHERE id = cand.id
    RETURNING to_jsonb(public.campaigns.*) INTO updated_camp;

    RETURN jsonb_build_object('served', true, 'campaign', updated_camp, 'impression', inserted_imp, 'cost', cost_per_imp);
  END LOOP;

  -- No eligible campaigns
  RETURN jsonb_build_object('served', false);
END;
$$;
