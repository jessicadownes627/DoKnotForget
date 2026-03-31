import Foundation
import Capacitor
import StoreKit

@objc(StoreKitPlugin)
public class StoreKitPlugin: CAPPlugin, CAPBridgedPlugin {

    public let identifier = "StoreKitPlugin"
    public let jsName = "StoreKit"

    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "purchase", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "restorePurchases", returnType: CAPPluginReturnPromise)
    ]

    @objc public func purchase(_ call: CAPPluginCall) {
        guard let productId = call.getString("productId") else {
            call.reject("Missing productId")
            return
        }

        Task {
            do {
                let products = try await Product.products(for: [productId])

                guard let product = products.first else {
                    call.reject("Product not found")
                    return
                }

                let result = try await product.purchase()

                switch result {
                case .success(let verification):
                    switch verification {
                    case .verified(let transaction):
                        await transaction.finish()
                        call.resolve(["success": true])
                    case .unverified:
                        call.reject("Unverified transaction")
                    }
                case .userCancelled:
                    call.reject("User cancelled")
                case .pending:
                    call.reject("Pending")
                @unknown default:
                    call.reject("Unknown result")
                }

            } catch {
                call.reject("Purchase failed")
            }
        }
    }

    @objc public func restorePurchases(_ call: CAPPluginCall) {
        Task {
            var hasPurchase = false

            for await result in Transaction.currentEntitlements {
                switch result {
                case .verified(let transaction):
                    if transaction.productID == "com.doknotforget.premium" {
                        hasPurchase = true
                    }
                case .unverified:
                    continue
                }
            }

            if hasPurchase {
                call.resolve(["success": hasPurchase])
            } else {
                call.resolve(["success": false])
            }
        }
    }
}
