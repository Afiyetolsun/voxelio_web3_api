# Voxelio Web3 API

Vercel serverless relay for the **Proof of Reality** iOS app. Holds the secrets the device shouldn't (Orbitport credentials, Swarm postage batch, Base Sepolia minter key) and exposes three endpoints.

## Endpoints

| Method | Path           | Body                                                      | Returns                              |
| ------ | -------------- | --------------------------------------------------------- | ------------------------------------ |
| POST   | `/api/nonce`   | _empty_                                                   | `{ nonce, satSig, expiresAt }`       |
| POST   | `/api/upload`  | multipart: `bundle`, `scene`, `audio?`                    | `{ swarmRef, bundleHash }`           |
| POST   | `/api/mint`    | `{ swarmRef, bundleHash, attestation }`                   | `{ txHash, tokenId, ensName? }`      |

All requests require the `X-Voxelio-Key` header set to `IOS_SHARED_SECRET`.

## Stub mode

Every external integration (Orbitport, Swarm, Base) falls back to a deterministic stub when its credentials are missing. The response shape stays the same and includes a `stub: true` field so the iOS app or a curl test can tell. This means the Vercel deployment is callable from day one, before any third-party keys land.

## Local dev

```
cp .env.example .env
pnpm install
pnpm dev
```

Server runs on `http://localhost:3000`.

## Deploy

```
vercel --prod
```

Set every value from `.env.example` in **Vercel → Project → Settings → Environment Variables**.

## License

MIT
