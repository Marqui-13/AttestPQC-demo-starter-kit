# Grant ISSUER_ROLE to a wallet on the deployed PQCAttestationRegistry proxy.
# Run from repo root or contracts/ with .env configured (PRIVATE_KEY = admin/deployer).

param(
    [Parameter(Mandatory = $true)]
    [string]$IssuerAddress,

    [string]$RegistryAddress = $env:REGISTRY_ADDRESS,
    [string]$RpcUrl = $env:BASE_SEPOLIA_RPC
)

if (-not $RegistryAddress) {
    Write-Error "Set REGISTRY_ADDRESS or pass -RegistryAddress (proxy from deploy logs)."
    exit 1
}
if (-not $RpcUrl) { $RpcUrl = "https://sepolia.base.org" }
if (-not $env:PRIVATE_KEY) {
    Write-Error "Set PRIVATE_KEY in contracts/.env (must be contract admin)."
    exit 1
}

$issuerRole = "0x114e74f6ea3bd819998f78687bfcb11b140da08e9b7d222fa9c1f1ba1f2aa122"

$cast = "$env:USERPROFILE\.foundry\bin\cast.exe"
if (-not (Test-Path $cast)) { $cast = "cast" }

& $cast send $RegistryAddress `
    "grantRole(bytes32,address)" `
    $issuerRole `
    $IssuerAddress `
    --private-key $env:PRIVATE_KEY `
    --rpc-url $RpcUrl

Write-Host "ISSUER_ROLE granted to $IssuerAddress on $RegistryAddress"