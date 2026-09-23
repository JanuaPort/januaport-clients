# SPDX-License-Identifier: Apache-2.0
# Copyright 2026 JanuaPort GmbH
#
# entra-sso-app.ps1 — JanuaPort-Anmeldung per Microsoft Entra: beide
# App-Registrierungen in einem Rutsch (Ressource "JanuaPort MCP" + Client
# "JanuaPort KI-Clients" für ChatGPT und claude.ai).
#
# Anleitung, Prüfliste und Grenzen: README.md in diesem Ordner.
# Status: siehe README.md, Abschnitt "Status" — die Graph-Aufrufe sind gegen einen
# echten Mandanten belegt, das Skript am Stück noch nicht.
#
# Gibt am Ende nur öffentliche Bezeichner aus (keine Geheimnisse): Verzeichnis-ID,
# die beiden Anwendungs-IDs und die JNPT_SSO_*-Werte für die Anlage.
#Requires -Modules Microsoft.Graph.Applications, Microsoft.Graph.Identity.SignIns
param(
  [Parameter(Mandatory)] [string]   $BoxHost,                 # z. B. jnpt.beispiel.de (ohne https://, ohne /mcp)
  [string]   $ResourceDisplayName = "JanuaPort MCP",
  [string]   $ClientDisplayName   = "JanuaPort KI-Clients",
  [string[]] $ClientRedirectUris  = @(),                       # Rückruf-URIs der KI-CLIENTS, z. B. https://chatgpt.com/connector/oauth/<id>
  [string]   $UiHost              = "",                        # Adresse der OBERFLÄCHE — z. B. jnpt.tailnet.ts.net; leer = kein Browser-Login
  [string[]] $Views                = @()                       # z. B. buchhaltung -> https://<host>/mcp/v/buchhaltung
)
# Ein halb angelegter Mandant ist schlimmer als ein abgebrochener Lauf: ohne Stop
# liefen die Folgeschritte mit leeren Objekten weiter.
$ErrorActionPreference = "Stop"

Connect-MgGraph -Scopes "Application.ReadWrite.All","DelegatedPermissionGrant.ReadWrite.All" -NoWelcome

$scopeId    = [guid]::NewGuid().Guid
$uris       = @("https://$BoxHost/mcp") + ($Views | ForEach-Object { "https://$BoxHost/mcp/v/$_" })
$graphAppId = "00000003-0000-0000-c000-000000000000"
$userRead   = "e1fe6dd8-ba31-4d61-89e7-88639da4683d"        # Microsoft Graph: User.Read (delegiert) — für die Ressource/Oberfläche
$openid          = "37f7f235-527c-4136-accd-4a02d197296e"   # Microsoft Graph: openid (delegiert)
$profile         = "14dad69e-099b-42c9-810b-d002981feec1"   # Microsoft Graph: profile (delegiert)
$offlineAccess   = "7427e0e9-2fba-42fe-b0c0-848c9e6a8182"   # Microsoft Graph: offline_access (delegiert)

# Die Rückruf-Adresse der OBERFLÄCHE gehört an die RESSOURCE (sie ist deren eigener
# öffentlicher Client) — nicht an die Client-Registrierung. Sie leitet sich NICHT aus
# der MCP-Adresse ab: Unter der ist die Oberfläche nicht erreichbar (JNPT_PUBLIC_URL
# trägt den /mcp-Pfad). $UiHost ist deshalb ein eigener Parameter; leer lassen, wenn
# an dieser Anlage niemand im Browser anmelden soll.
$resourceRedirectUris = @()
if ($UiHost) { $resourceRedirectUris += "https://$UiHost/me/callback" }

# Schritt 1 (Ressource): Registrierung anlegen — Token-Version 2 im selben Aufruf wie
# die https-URIs: Apps mit requestedAccessTokenVersion 2 sind von Entras Muster-Regel
# für App-ID-URIs ausgenommen (README, Grenzen). Lehnt Entra hier trotzdem ab („must
# contain a tenant verified domain …"), eine Adresse unter einer verifizierten Domäne
# des Mandanten wählen.
$resourceApp = New-MgApplication -DisplayName $ResourceDisplayName -SignInAudience "AzureADMyOrg" `
  -IsFallbackPublicClient:$true -IdentifierUris $uris `
  -Api @{
    RequestedAccessTokenVersion = 2
    Oauth2PermissionScopes = @(@{
      Id = $scopeId; Value = "access"; Type = "User"; IsEnabled = $true
      AdminConsentDisplayName = "JanuaPort MCP nutzen"
      AdminConsentDescription = "Erlaubt den Zugriff auf die JanuaPort-MCP-Werkzeuge im Namen des angemeldeten Nutzers."
      UserConsentDisplayName  = "JanuaPort MCP nutzen"
      UserConsentDescription  = "Erlaubt der App, in deinem Namen auf JanuaPort MCP zuzugreifen."
    })
  } `
  -PublicClient @{ RedirectUris = $resourceRedirectUris } `
  -RequiredResourceAccess @(@{ ResourceAppId = $graphAppId; ResourceAccess = @(@{ Id = $userRead; Type = "Scope" }) })

# Schritt 2 (Ressource): api://<appId> ergänzen und den eigenen Bereich als
# API-Berechtigung eintragen — beides braucht die Anwendungs-ID, die erst jetzt existiert.
Update-MgApplication -ApplicationId $resourceApp.Id `
  -IdentifierUris (@("api://$($resourceApp.AppId)") + $uris) `
  -RequiredResourceAccess @(
    @{ ResourceAppId = $graphAppId;        ResourceAccess = @(@{ Id = $userRead; Type = "Scope" }) },
    @{ ResourceAppId = $resourceApp.AppId; ResourceAccess = @(@{ Id = $scopeId;  Type = "Scope" }) }
  )

# Schritt 3 (Ressource): Unternehmensanwendung anlegen und die eigene
# Admin-Einwilligung erteilen (User.Read + der eigene Bereich für die Oberfläche).
$resourceSp = New-MgServicePrincipal -AppId $resourceApp.AppId
$graphSp    = Get-MgServicePrincipal -Filter "appId eq '$graphAppId'"
if ($UiHost) {
  New-MgOauth2PermissionGrant -ClientId $resourceSp.Id -ConsentType "AllPrincipals" -ResourceId $graphSp.Id    -Scope "User.Read" | Out-Null
  New-MgOauth2PermissionGrant -ClientId $resourceSp.Id -ConsentType "AllPrincipals" -ResourceId $resourceSp.Id -Scope "access"    | Out-Null
}

# Schritt 4 (Client): die GETRENNTE Registrierung für die KI-Clients — public client,
# eigene Rückruf-URIs, Berechtigung auf den Ressourcen-Scope UND auf Graph
# openid/profile/offline_access (Refresh-Token). Verhindert AADSTS90009 (README,
# "Warum zwei Registrierungen"), weil Client und Ressource nie dieselbe App sind.
$clientApp = New-MgApplication -DisplayName $ClientDisplayName -SignInAudience "AzureADMyOrg" `
  -IsFallbackPublicClient:$true `
  -PublicClient @{ RedirectUris = $ClientRedirectUris } `
  -RequiredResourceAccess @(
    @{ ResourceAppId = $resourceApp.AppId; ResourceAccess = @(@{ Id = $scopeId; Type = "Scope" }) },
    @{ ResourceAppId = $graphAppId;        ResourceAccess = @(
         @{ Id = $openid;        Type = "Scope" },
         @{ Id = $profile;       Type = "Scope" },
         @{ Id = $offlineAccess; Type = "Scope" }
       ) }
  )

# Schritt 5 (Client): Unternehmensanwendung anlegen und die Admin-Einwilligung
# erteilen — für BEIDE angeforderten Berechtigungen in einem Rutsch.
$clientSp = New-MgServicePrincipal -AppId $clientApp.AppId
New-MgOauth2PermissionGrant -ClientId $clientSp.Id -ConsentType "AllPrincipals" -ResourceId $resourceSp.Id -Scope "access" | Out-Null
New-MgOauth2PermissionGrant -ClientId $clientSp.Id -ConsentType "AllPrincipals" -ResourceId $graphSp.Id    -Scope "openid profile offline_access" | Out-Null

# Ausgabe: die Werte für JanuaPort (öffentliche Bezeichner, keine Geheimnisse)
$tenant = (Get-MgContext).TenantId
"Verzeichnis-ID (Mandant):        $tenant"
"Anwendungs-ID der RESSOURCE:     $($resourceApp.AppId)"
"Anwendungs-ID des CLIENTS:       $($clientApp.AppId)"
""
"JNPT_PUBLIC_URL=https://$BoxHost/mcp"
"JNPT_SSO_ISSUER=https://login.microsoftonline.com/$tenant/v2.0"
"JNPT_SSO_AUDIENCE=$($resourceApp.AppId)"
"JNPT_SSO_AUTH_SCOPE=api://$($resourceApp.AppId)/access offline_access"
"JNPT_SSO_CLIENT_ID=$($clientApp.AppId)"
