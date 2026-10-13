import ExpoModulesCore

/// Installs the cockpit tab-bar lift once, when UIKit is ready to receive
/// delegate callbacks. The hooks do not need the window yet: the sheet is
/// detected later, on layout.
public class NolumeSheetTabBarSubscriber: ExpoAppDelegateSubscriber {
  public func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    NolumeSheetTabBar.install()
    return true
  }
}
