import UIKit
import Capacitor

class BridgeViewController: CAPBridgeViewController {

    override open func capacitorDidLoad() {
        super.capacitorDidLoad()

        print("🔥 capacitorDidLoad running")

        self.bridge?.registerPluginInstance(StoreKitPlugin())

        print("✅ StoreKitPlugin registered")
    }
}
