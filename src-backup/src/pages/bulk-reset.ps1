# bulk-reset.ps1

# List of user emails (admin removed)
$emails = @(
  "Lyndonj@broadcastmedia.com",
  "tonito@mindcoachconsulting.com",
  "kagudaprince@gmail.com",
  "ejioforkutlwano@gmail.com",
  "phathumutsharini@gmail.com",
  "baloyiurgent@gmail.com",
  "oghenetegaolose@gmail.com",
  "comfortngcb@live.com",
  "ejeckson@yahoo.com",
  "katlego.meyatho@gmail.com",
  "molebogenga@gmail.com",
  "denis.ackulay@gmail.com",
  "silienou@yahoo.com",
  "lydia.tonitosamuel@gmail.com",
  "zamaglee@gmail.com",
  "eama00@gmail.com",
  "easymagic1@gmail.com",
  "lowelljeffery0206@gmail.com",
  "dadadaniel2002@gmail.com",
  "thavjnred@gmail.com",
  "thavinred@gmail.com",
  "vashnitech@yahoo.com",
  "greonard2002@yahoo.com"
)

# Your admin secret
$secret = "set-a-strong-secret"

# Prepare JSON body
$body = @{
  secret = $secret
  emails = $emails
} | ConvertTo-Json

# Send POST request to your backend
$response = Invoke-RestMethod -Uri "http://localhost:4000/admin/bulk-reset" `
  -Method Post `
  -ContentType "application/json" `
  -Body $body

# Output the result
$response | ConvertTo-Json -Depth 5