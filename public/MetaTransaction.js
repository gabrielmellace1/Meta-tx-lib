class MetaTransactionHandler {
  constructor(
    contractAddress,
    contractAbi,
    domainData = undefined,
    relayerURL = undefined,
    onSignedCallback = undefined,
    onReceiptCallback = undefined,
    onErrorCallback = undefined,
    walletProviderType = "metamask",
    provider = undefined
  ) {
    this.networkConfig = {
      1: {
        chainId: "0x1",
        chainName: "Ethereum Mainnet",
        nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
        rpcUrls: ["https://mainnet.infura.io/v3/YOUR_INFURA_PROJECT_ID"],
        blockExplorerUrls: ["https://etherscan.io"],
      },
      3: {
        chainId: "0x3",
        chainName: "Ropsten Testnet",
        nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
        rpcUrls: ["https://ropsten.infura.io/v3/YOUR_INFURA_PROJECT_ID"],
        blockExplorerUrls: ["https://ropsten.etherscan.io"],
      },
      137: {
        chainId: "0x89",
        chainName: "Matic(Polygon) Mainnet",
        nativeCurrency: { name: "MATIC", symbol: "MATIC", decimals: 18 },
        rpcUrls: ["https://polygon-rpc.com"],
        blockExplorerUrls: ["https://www.polygonscan.com/"],
      },
      // Add more network configurations here
    };

    this.domainType = [
      { name: "name", type: "string" },
      { name: "version", type: "string" },
      { name: "chainId", type: "uint256" },
      { name: "verifyingContract", type: "address" },
    ];
    this.metaTransactionType = [
      { name: "nonce", type: "uint256" },
      { name: "from", type: "address" },
      { name: "functionSignature", type: "bytes" },
    ];

    this.onSignedCallback = onSignedCallback;
    this.onReceiptCallback = onReceiptCallback;
    this.onErrorCallback = onErrorCallback;

    this.ethers = window.ethers;
    this.relayerURL =
      relayerURL || "https://dgtxserver.dcl.guru/v1/transactions";
    // this.provider = provider || this.setRPC(RPC);

    this.contractAddress = contractAddress;
    this.contractAbi = contractAbi;
    this.domainData = domainData;
    this.walletProviderType = walletProviderType;
    this.initProvider(provider);
  }

  async initProvider(provider) {
    this.provider = await new ethers.providers.Web3Provider(provider);
  }

  getNetworkProvider(chainId) {
    switch (chainId) {
      case 137:
        return "https://polygon-rpc.com";
      default:
        return "https://polygon-rpc.com";
    }
  }

  async initContract(chainId) {
    const provider = new ethers.providers.JsonRpcProvider(
      this.getNetworkProvider(chainId)
    );
    const signer = provider.getSigner(this.address.toString());

    this.contract = await new ethers.Contract(
      this.contractAddress,
      this.contractAbi,
      signer
    );
  }

  async initSigner() {
    //this.accounts = await ethereum.request({ method: "eth_requestAccounts" });

    this.signer = await this.provider.getSigner();

    this.address = await this.signer.getAddress();

    console.log("address", this.address);
  }

  verifyReadyState() {
    return true;
    /*if (typeof ethereum !== "undefined") {
      if (this.provider == undefined) {
        return false;
      }

      return true;
    } else {
      alert("Please install MetaMask to interact with this webpage.");
      return false;
    }*/
  }

  async executeMetaTransaction(functionName, parameters, chainId) {
    try {
      //await this.switchNetwork(this.domainData.chainId);
      //this.setRPC(chainId);
      await this.initSigner();
      await this.initContract(chainId);
      // Verify that everything is ready

      if (this.verifyReadyState()) {
        const functionCallHex = await this.contract.populateTransaction[
          functionName
        ](...parameters);

        const nonce = await this.getNonce();

        const message = {
          nonce: nonce.toString(),
          from: this.address,
          functionSignature: functionCallHex.data,
        };
        const dataToSign = JSON.stringify({
          types: {
            EIP712Domain: this.domainType,
            MetaTransaction: this.metaTransactionType,
          },
          domain: this.domainData,
          primaryType: "MetaTransaction",
          message: message,
        });

        const userSignature = await this.requestUserSignature(dataToSign);

        const serverPayload = JSON.stringify({
          transactionData: {
            from: this.address,
            params: [
              this.contractAddress,
              this.getExecuteMetaTransactionData(
                this.address,
                userSignature,
                functionCallHex.data
              ),
            ],
          },
        });

        if (this.onSignedCallback) {
          this.onSignedCallback(userSignature);
        }

        const response = await this.post(this.relayerURL, serverPayload);
        const data = await response.json();
        const receipt = await this.provider.waitForTransaction(data.txHash);

        if (this.onReceiptCallback) {
          this.onReceiptCallback(receipt);
        }

        return data;
      } else {
        if (this.onErrorCallback) {
          this.onErrorCallback(
            "Module not ready, please set all of the parameters"
          );
        } else {
          console.log("Module not ready, please set all of the parameters");
        }
      }
    } catch (error) {
      if (this.onErrorCallback) {
        this.onErrorCallback(error);
      } else {
        console.log(error);
      }
    }
  }

  async getNonce() {
    let nonce = "";
    try {
      debugger;
      nonce = await this.contract.getNonce(this.address.toString());
    } catch (error) {
      console.log(error);
    }
    debugger;
    return nonce;
  }

  async requestUserSignature(dataToSign) {
    let status;
    switch (this.walletProviderType) {
      case "metamask":
        status = await this.walletProvider.request({
          method: "eth_signTypedData_v4",
          params: [this.address.toString(), dataToSign],
          jsonrpc: "2.0",
          id: 999999999999,
        });
        break;
      case "web3auth":
        debugger;
        status = await this.signer.provider.send("eth_signTypedData_v4", [
          this.address.toString(),
          dataToSign,
        ]);
        break;
      default:
        break;
    }

    return status;
  }

  getExecuteMetaTransactionData(account, fullSignature, functionSignature) {
    const signature = fullSignature.replace("0x", "");
    const r = signature.substring(0, 64);
    const s = signature.substring(64, 128);
    const v = this.normalizeVersion(signature.substring(128, 130));

    const method = functionSignature.replace("0x", "");
    const signatureLength = (method.length / 2).toString(16);
    const signaturePadding = Math.ceil(method.length / 64);

    return [
      "0x",
      "0c53c51c",
      this.to32Bytes(account),
      this.to32Bytes("a0"),
      r,
      s,
      this.to32Bytes(v),
      this.to32Bytes(signatureLength),
      this.padEnd(method, 64 * signaturePadding),
    ].join("");
  }

  async executeDirectTransaction(
    functionName,
    parameters,
    chainId,
    onSignedCallback = undefined,
    onReceiptCallback = undefined
  ) {
    // Verify that everything is ready

    try {
      await this.switchNetwork(chainId);

      this.provider = await new ethers.providers.Web3Provider(window.ethereum);
      await this.initSigner();
      await this.initContract();

      if (this.verifyReadyState()) {
        const txResponse = await this.contract[functionName](...parameters);

        if (this.onSignedCallback) {
          this.onSignedCallback(txResponse);
        }

        const receipt = await txResponse.wait();

        if (this.onReceiptCallback) {
          this.onReceiptCallback(receipt);
        }

        return receipt;
      } else {
        if (this.onErrorCallback) {
          this.onErrorCallback(
            "Module not ready, please set all of the parameters"
          );
        } else {
          console.log("Module not ready, please set all of the parameters");
        }
      }
    } catch (error) {
      if (this.onErrorCallback) {
        this.onErrorCallback(error);
      } else {
        console.log(error);
      }
    }
  }

  normalizeVersion(version) {
    let parsed = parseInt(version, 16);
    if (parsed < 27) {
      // this is because Ledger returns 0 or 1
      parsed += 27;
    }
    if (parsed !== 27 && parsed !== 28) {
      //throw Error(Invalid signature version "${version}" (parsed: ${parsed}))
    }
    return parsed.toString(16);
  }

  to32Bytes(value) {
    return this.padStart(value.toString().replace("0x", ""), 64);
  }
  padStart(src, length) {
    const len = src.length;
    if (len >= length) return src;
    if (len % 2 !== 0) src = "0" + src;
    if (len < length)
      while (src.length < length) {
        src = "0" + src;
      }
    return src;
  }

  padEnd(src, length) {
    const len = src.length;
    if (len >= length) return src;
    if (len % 2 !== 0) src = "0" + src;
    if (len < length)
      while (src.length < length) {
        src += "0";
      }
    return src;
  }

  async post(url, body) {
    return fetch(`${url}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body,
    });
  }

  async switchNetwork(targetChainId) {
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    const currentChainId = (await provider.getNetwork()).chainId;

    if (currentChainId !== targetChainId) {
      try {
        // Request user to switch to the target network
        await window.ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: this.networkConfig[targetChainId].chainId }],
        });
      } catch (switchError) {
        if (switchError.code === 4902) {
          // The network is not added to the user's MetaMask and should be added manually
          try {
            await window.ethereum.request({
              method: "wallet_addEthereumChain",
              params: [this.networkConfig[targetChainId]],
            });
          } catch (addError) {
            // Handle "add" error
          }
        }
        // Handle other "switch" errors
      }
    }
  }
}
