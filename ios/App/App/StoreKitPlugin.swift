import Foundation
import Capacitor
import StoreKit

@objc(StoreKitPlugin)
public class StoreKitPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "StoreKitPlugin"
    public let jsName = "StoreKit"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getProducts", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "purchase", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "restorePurchases", returnType: CAPPluginReturnPromise)
    ]

    @objc func getProducts(_ call: CAPPluginCall) {
        guard #available(iOS 15.0, *) else {
            call.reject("StoreKit 2 requires iOS 15 or later.")
            return
        }

        guard let productIds = call.getArray("productIds", String.self), !productIds.isEmpty else {
            call.reject("productIds is required.")
            return
        }

        Task { @MainActor in
            do {
                let products = try await Product.products(for: productIds)
                let payload = products.map { product in
                    [
                        "id": product.id,
                        "title": product.displayName,
                        "description": product.description,
                        "displayPrice": product.displayPrice
                    ]
                }
                call.resolve(["products": payload])
            } catch {
                call.reject("Failed to load products.", nil, error)
            }
        }
    }

    @objc func purchase(_ call: CAPPluginCall) {
        guard #available(iOS 15.0, *) else {
            call.reject("StoreKit 2 requires iOS 15 or later.")
            return
        }

        guard let productId = call.getString("productId"), !productId.isEmpty else {
            call.reject("productId is required.")
            return
        }

        Task { @MainActor in
            do {
                let products = try await Product.products(for: [productId])
                guard let product = products.first else {
                    call.reject("Product not found.")
                    return
                }

                let result = try await product.purchase()
                switch result {
                case .success(let verificationResult):
                    let transaction = try self.checkVerified(verificationResult)
                    await transaction.finish()
                    call.resolve([
                        "status": "purchased",
                        "productId": transaction.productID
                    ])
                case .userCancelled:
                    call.resolve(["status": "cancelled"])
                case .pending:
                    call.resolve(["status": "pending"])
                @unknown default:
                    call.resolve(["status": "pending"])
                }
            } catch {
                call.reject("Purchase failed.", nil, error)
            }
        }
    }

    @objc func restorePurchases(_ call: CAPPluginCall) {
        guard #available(iOS 15.0, *) else {
            call.reject("StoreKit 2 requires iOS 15 or later.")
            return
        }

        Task { @MainActor in
            do {
                try await AppStore.sync()
                var productIds = Set<String>()
                for await result in Transaction.currentEntitlements {
                    if case .verified(let transaction) = result {
                        productIds.insert(transaction.productID)
                    }
                }
                call.resolve(["productIds": Array(productIds)])
            } catch {
                call.reject("Restore purchases failed.", nil, error)
            }
        }
    }

    @available(iOS 15.0, *)
    private func checkVerified<T>(_ result: VerificationResult<T>) throws -> T {
        switch result {
        case .verified(let safe):
            return safe
        case .unverified:
            throw NSError(domain: "StoreKitPlugin", code: 0, userInfo: [
                NSLocalizedDescriptionKey: "Transaction verification failed."
            ])
        }
    }
}
