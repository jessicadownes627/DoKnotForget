import UIKit
import Capacitor

class BridgeViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        super.capacitorDidLoad()

        print("🔥 capacitorDidLoad running")

        // bridge?.registerPluginType(StoreKitPlugin.self)

        print("✅ StoreKitPlugin registered")
    }
}
