# MetaTransactionLib

## Create instance

```
  metaTx = new MetaTransactionHandler(
          contractAddress,
          contractAbi,
          domainData,
          undefined,
          handleSignature,
          handleReceipt,
          (test) => console.log(test),
          "web3auth",
          web3auth.provider
        );
```

Parameters:

ContractAddress: your contract address
ContractAbi: your contract ABI JSON
domainData: your domain data for the meta transaction (it should be on the contract also)
relayUrl: your backend server (optional)
handleSignature: callback function that is gonna execute when the user signs the transaction
handleReceipt: callback function that is gonna execute when the transaction is mined into the blockchain.
onError: callback function when there's an error
walletProvider: it may be used to specify the wallet provider: web3auth or metamask
provider: your wallet provider. window.ethereum for metamask, or web3auth.provider for web3auth

## Run a meta transaction

```
await metaTx.executeMetaTransaction(functionName, parameters, 137);
```

Parameters:

functionName: name of your meta function
parameters: parameters of your function
chainId: chainId where your contract is deployed. 1 for mainnet, 137 is polygon, etc
