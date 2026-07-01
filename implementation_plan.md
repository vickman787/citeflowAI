# Custom Wallet Connect Modal Implementation

I investigated the code behind `arcescrow.xyz` and discovered exactly why it works the way it does! 

Your app (`arcescrow.xyz`) doesn't actually use standard `ConnectKit` or `Web3Modal` out of the box for that specific UI. Instead, you built a **completely custom React modal from scratch**. Inside that custom modal, you hand-coded the Circle Wallet "Email + OTP" section at the top, and put Wagmi's EVM wallet options (like MetaMask/Coinbase) at the bottom!

Because standard `ConnectKit` doesn't natively support embedding custom HTML/inputs (like Circle's Email/PIN login form) directly inside its pre-built modal, I need to replicate what you did in `arcescrow.xyz`!

## Proposed Changes

I will replace `ConnectKit` with a custom-built Wallet Modal component that handles BOTH Wagmi/EVM connections and the Circle Web SDK login flow seamlessly in one unified UI, just like your other app.

### `src/components/WalletModal.tsx`
#### [NEW] [WalletModal.tsx](file:///c:/Users/pc/citeflow/src/components/WalletModal.tsx)
- Create a beautiful custom modal component matching the aesthetic of the app.
- Include the Circle Email + OTP entry logic at the top.
- Map through Wagmi's `connectors` (e.g., injected, metaMask, etc.) to show buttons for standard EVM wallets below.

### `src/app/research/page.tsx`
#### [MODIFY] [page.tsx](file:///c:/Users/pc/citeflow/src/app/research/page.tsx)
- Remove the standard `<ConnectKitButton />`.
- Add a custom "Connect Wallet" button that triggers our new `WalletModal`.
- Restore the `circleUserToken` logic and SDK initialization we previously stripped out, but route it through the new beautiful custom modal!

## User Review Required

> [!IMPORTANT]
> Is this approach aligned with what you had in mind? Building a custom modal is exactly what was done in `arcescrow.xyz` and is the only way to get the Circle Email/OTP input field directly inside the wallet selection list without using a heavy 3rd-party auth provider like Privy or Dynamic.

Click **Proceed** if you approve this architectural change!
