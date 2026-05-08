# Voxelio Web3 API

Vercel serverless relay for the **Proof of Reality** iOS app. Holds the secrets the device shouldn't (Orbitport credentials, Swarm postage batch, Base Sepolia minter key) and exposes three endpoints. Built at ETHPrague 2026 on the SpaceComputer track.

## Endpoints

| Method | Path           | Body                                                      | Returns                              |
| ------ | -------------- | --------------------------------------------------------- | ------------------------------------ |
| GET    | `/api/health`  | _empty_                                                   | `{ status, env, timestamp }`         |
| POST   | `/api/nonce`   | _empty_                                                   | `{ nonce, satSig, satPk, src, expiresAt, stub }` |
| POST   | `/api/upload`  | multipart: `bundle`, `scene`, `audio?`                    | `{ swarmRef, bundleHash, sceneBytes, stub }` |
| POST   | `/api/mint`    | `{ swarmRef, bundleHash, satSig?, attestation, recipient? }` | `{ txHash, tokenId, ensName, stub }` |

Every request except `/api/health` requires the header
```
X-Voxelio-Key: <IOS_SHARED_SECRET>
```

## Stub mode

Each external integration falls back to a deterministic stub when its credentials are missing:

| Endpoint     | Stub trigger                                                   | Stub behaviour                                       |
| ------------ | -------------------------------------------------------------- | ---------------------------------------------------- |
| `/api/nonce` | `ORBITPORT_CLIENT_ID` or `ORBITPORT_CLIENT_SECRET` missing     | locally-generated 32-byte hex, `satSig: "STUB"`      |
| `/api/upload` | `SWARM_POSTAGE_BATCH_ID` missing                              | `swarmRef: "stub:<sha256>"`                          |
| `/api/mint`  | `MINTER_PRIVATE_KEY` or `REALITY_PROOF_ADDRESS` missing        | random 0x tx hash + tokenId                          |

Every stubbed response carries `stub: true`, so the iOS verifier (and grep-able logs) can tell. **Stub bundles must never be treated as real proofs on-chain.**

## Local dev

```
cp .env.example .env
pnpm install
pnpm dev
```

Server runs on `http://localhost:3000` (override with `PORT=3333 pnpm dev`).

### Smoke tests

```bash
# Health (no auth)
curl http://localhost:3000/api/health

# Cosmic nonce
curl -X POST http://localhost:3000/api/nonce \
  -H "X-Voxelio-Key: changeme"

# Upload bundle + scene
echo '{"version":1,"mode":"roomPlan"}' > /tmp/bundle.json
echo 'fake-usdz' > /tmp/scene.usdz
curl -X POST http://localhost:3000/api/upload \
  -H "X-Voxelio-Key: changeme" \
  -F 'bundle=@/tmp/bundle.json;type=application/json' \
  -F 'scene=@/tmp/scene.usdz;type=model/vnd.usdz+zip'

# Mint
curl -X POST http://localhost:3000/api/mint \
  -H "X-Voxelio-Key: changeme" \
  -H "Content-Type: application/json" \
  -d '{"swarmRef":"stub:abc","bundleHash":"6f6f6c","attestation":"MOCK"}'
```

## Deploy

```
pnpm install
vercel --prod
```

Set every value from `.env.example` in **Vercel → Project → Settings → Environment Variables**, then redeploy. The iOS app reads its base URL + shared secret from `voxelio_web3/Resources/Secrets.xcconfig`.

### Production checklist

- [ ] `IOS_SHARED_SECRET` rotated to a strong random value (≥ 32 chars)
- [ ] `ORBITPORT_CLIENT_ID` / `_SECRET` filled in (Orbitport early-access form approved)
- [ ] `SWARM_POSTAGE_BATCH_ID` purchased and copied in
- [ ] `MINTER_PRIVATE_KEY` is a hackathon-only wallet, funded with Base Sepolia ETH
- [ ] `REALITY_PROOF_ADDRESS` matches the contract deployed by the contracts repo
- [ ] All endpoints return `stub: false` after the steps above

## Repo map

This is one of four repos that make up Proof of Reality:

| Repo | Purpose |
| --- | --- |
| `voxelio_web3` | iOS capture app (RoomPlan + Object Capture, ProofSession) |
| `voxelio_web3_api` (this) | Vercel relay |
| `voxelio_web3_contracts` | Foundry contracts on Base — `RealityProof.sol`, `Minted` event |
| `voxelio_web3_viewer` | Next.js verifier (gsplat.js + 4-check UI) |

## License

MIT
