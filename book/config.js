// Early Bird's own Supabase project (the same one the iPhone app uses). The key is the PUBLISHABLE key: it is meant to be
// public and can only do what row-level security and the exposed `api.*` functions allow. No secret keys live in the site.
// Stripe's publishable key is not here: the `pay` Edge Function hands it out together with the PaymentIntent.
window.EB_CONFIG = {
  env: "production",
  url: "https://xopcdblqmmrvyocqomqz.supabase.co",
  key: "sb_publishable_TW9FPHv3ijsOZx4QPTIsdA_hSWFafW4",
  payUrl: "https://xopcdblqmmrvyocqomqz.supabase.co/functions/v1/pay",
  siteUrl: "https://eatearlybird.com",
  creditName: "Early Bird credit"
};
