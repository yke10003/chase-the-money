import ObjectiveC
import UIKit

/// A page sheet covers the window, including the tab bar. Keep the bar in the
/// sheet container, in its original place, so the sheet scrolls underneath it.
///
/// Recovered from the October 11 implementation that lived in the generated
/// AppDelegate. It now installs from `NolumeSheetTabBarSubscriber` so a later
/// prebuild cannot delete it. Only a presented sheet whose `screenId` is
/// `cockpit` is followed.
enum NolumeSheetTabBar {
  private static var installed = false
  private static weak var lifted: UIView?
  private static weak var homeSuperview: UIView?
  private static var homeFrame: CGRect = .zero
  private static var homeAutoresizing: UIView.AutoresizingMask = []
  private static var windowFrame: CGRect = .zero
  private static var savedConstraints: [NSLayoutConstraint] = []
  private static var pending = false
  private static var reportedMissingBar = false
  static let cockpitId = "cockpit"

  static func install() {
    guard !installed else { return }
    installed = true

    let layout = exchange(UIViewController.self, #selector(UIViewController.viewDidLayoutSubviews), #selector(UIViewController.nolume_viewDidLayoutSubviews))
    let disappear = exchange(UIViewController.self, #selector(UIViewController.viewDidDisappear(_:)), #selector(UIViewController.nolume_viewDidDisappear(_:)))
    let add = exchange(UIView.self, #selector(UIView.addSubview(_:)), #selector(UIView.nolume_addSubview(_:)))
    let barLayout = addOrExchange(UITabBar.self, #selector(UIView.layoutSubviews), #selector(UITabBar.nolume_layoutSubviews))

    if layout && disappear && add && barLayout {
      nolumeLog("installed")
    } else {
      nolumeLog("install failed layout=\(layout) disappear=\(disappear) addSubview=\(add) tabBarLayout=\(barLayout)")
    }
  }

  /// The tab bar controller puts its bar back on every layout. Refuse that while a sheet is up.
  static func shouldRejectReclaim(of view: UIView, onto host: UIView) -> Bool {
    lifted === view && homeSuperview === host
  }

  @discardableResult
  private static func exchange(_ cls: AnyClass, _ original: Selector, _ swizzled: Selector) -> Bool {
    guard let current = class_getInstanceMethod(cls, original),
          let replacement = class_getInstanceMethod(cls, swizzled) else { return false }
    method_exchangeImplementations(current, replacement)
    return true
  }

  @discardableResult
  private static func addOrExchange(_ cls: AnyClass, _ original: Selector, _ swizzled: Selector) -> Bool {
    guard let originalMethod = class_getInstanceMethod(cls, original),
          let swizzledMethod = class_getInstanceMethod(cls, swizzled) else { return false }
    let didAdd = class_addMethod(cls, original, method_getImplementation(swizzledMethod), method_getTypeEncoding(swizzledMethod))
    if didAdd {
      class_replaceMethod(cls, swizzled, method_getImplementation(originalMethod), method_getTypeEncoding(originalMethod))
    } else {
      method_exchangeImplementations(originalMethod, swizzledMethod)
    }
    return true
  }

  static func sync(in window: UIWindow) {
    guard let sheet = window.nolumeCockpitSheet(),
          let container = sheet.presentationController?.containerView else {
      restore()
      return
    }

    guard let bar = window.nolumeFloatingTabBar() else {
      if !reportedMissingBar {
        reportedMissingBar = true
        nolumeLog("cockpit sheet is up and the tab bar was not found")
      }
      return
    }
    reportedMissingBar = false
    lift(bar, into: container, window: window)
  }

  static func schedule(in window: UIWindow) {
    guard !pending else { return }
    pending = true
    DispatchQueue.main.async {
      pending = false
      sync(in: window)
    }
  }

  private static func lift(_ bar: UIView, into container: UIView, window: UIWindow) {
    if lifted !== bar || homeSuperview == nil {
      guard let home = bar.superview, home !== container else { return }
      let frame = bar.convert(bar.bounds, to: window)
      guard frame.height > 20, frame.width > 40 else { return }
      homeSuperview = home
      homeFrame = bar.frame
      homeAutoresizing = bar.autoresizingMask
      windowFrame = frame
      lifted = bar
    }

    if bar.superview !== container {
      if savedConstraints.isEmpty {
        savedConstraints = (bar.superview?.constraints ?? []).filter { constraint in
          constraint.firstItem as? UIView === bar || constraint.secondItem as? UIView === bar
        }
      }
      NSLayoutConstraint.deactivate(savedConstraints)
      container.addSubview(bar)
      nolumeLog("lifted tab bar into the cockpit sheet")
    }

    let frame = container.convert(windowFrame, from: window)
    guard bar.frame.integral != frame.integral else { return }
    bar.translatesAutoresizingMaskIntoConstraints = true
    bar.autoresizingMask = []
    bar.frame = frame
  }

  static func restore() {
    guard let bar = lifted, let home = homeSuperview else { return }
    let frame = homeFrame
    let mask = homeAutoresizing
    lifted = nil
    homeSuperview = nil
    home.addSubview(bar)
    bar.frame = frame
    bar.autoresizingMask = mask
    NSLayoutConstraint.activate(savedConstraints)
    savedConstraints = []
    reportedMissingBar = false
    nolumeLog("restored tab bar")
  }
}

private func nolumeLog(_ message: String) {
  #if DEBUG
  print("[NolumeSheetTabBar] \(message)")
  #endif
}

extension UIViewController {
  @objc func nolume_viewDidLayoutSubviews() {
    nolume_viewDidLayoutSubviews()
    guard nolumeIsCockpitSheet, let window = view.window ?? presentationController?.containerView?.window else { return }
    NolumeSheetTabBar.schedule(in: window)
  }

  @objc func nolume_viewDidDisappear(_ animated: Bool) {
    let cockpit = nolumeIsCockpitSheet
    nolume_viewDidDisappear(animated)
    if cockpit {
      NolumeSheetTabBar.restore()
    }
  }

  var nolumeIsCockpitSheet: Bool {
    guard sheetPresentationController != nil else { return false }
    return nolumeScreenId(of: self) == NolumeSheetTabBar.cockpitId
  }
}

private func nolumeScreenId(of controller: UIViewController) -> String? {
  let object = controller.view as NSObject
  let selector = NSSelectorFromString("screenId")
  guard object.responds(to: selector) else { return nil }
  return object.value(forKey: "screenId") as? String
}

extension UITabBar {
  @objc func nolume_layoutSubviews() {
    nolume_layoutSubviews()
    guard let window else { return }
    NolumeSheetTabBar.schedule(in: window)
  }
}

extension UIView {
  @objc func nolume_addSubview(_ view: UIView) {
    if NolumeSheetTabBar.shouldRejectReclaim(of: view, onto: self) {
      return
    }
    nolume_addSubview(view)
  }
}

extension UIWindow {
  func nolumeCockpitSheet() -> UIViewController? {
    func isCockpit(_ controller: UIViewController) -> Bool {
      guard controller.sheetPresentationController != nil else { return false }
      return nolumeScreenId(of: controller) == NolumeSheetTabBar.cockpitId
    }

    func walk(_ controller: UIViewController?) -> UIViewController? {
      guard let controller else { return nil }
      if let presented = controller.presentedViewController {
        if isCockpit(presented) {
          return presented
        }
        if let nested = walk(presented) {
          return nested
        }
      }
      for child in controller.children {
        if isCockpit(child) {
          return child
        }
        if let found = walk(child) {
          return found
        }
      }
      return nil
    }

    return walk(rootViewController)
  }

  func nolumeFloatingTabBar() -> UIView? {
    nolumeFindTabBar()
  }

  private func nolumeFindTabBar() -> UITabBar? {
    for child in subviews {
      if let found = child.nolumeFindTabBarInSubtree() {
        return found
      }
    }
    return nil
  }
}

extension UIView {
  fileprivate func nolumeFindTabBarInSubtree() -> UITabBar? {
    if let bar = self as? UITabBar {
      return bar
    }
    for child in subviews {
      if let found = child.nolumeFindTabBarInSubtree() {
        return found
      }
    }
    return nil
  }
}
