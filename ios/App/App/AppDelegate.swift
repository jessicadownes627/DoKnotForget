import UIKit
import Capacitor

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
    ) -> Bool {

        let bridgeVC = BridgeViewController()

        window = UIWindow(frame: UIScreen.main.bounds)
        window?.rootViewController = bridgeVC
        window?.makeKeyAndVisible()

        return true
    }
}
