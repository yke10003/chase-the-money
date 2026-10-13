Pod::Spec.new do |s|
  s.name           = 'NolumeSheetTabBar'
  s.version        = '1.0.0'
  s.summary        = 'Lifts the system tab bar above the Nolume cockpit sheet.'
  s.description    = 'Tracks the cockpit form sheet and reparents the system UITabBar into its presentation container.'
  s.license        = { :type => 'UNLICENSED' }
  s.author         = 'Nolume'
  s.homepage       = 'https://10003.nl'
  s.platforms      = { :ios => '16.4' }
  s.source         = { :path => '.' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
  s.source_files = '**/*.{h,m,mm,swift}'
end
