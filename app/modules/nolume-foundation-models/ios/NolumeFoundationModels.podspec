Pod::Spec.new do |s|
  s.name           = 'NolumeFoundationModels'
  s.version        = '1.0.0'
  s.summary        = 'On-device listing generation with Apple Foundation Models.'
  s.description    = 'A small Expo module that asks the on-device system language model for a marketplace title and description.'
  s.license        = { :type => 'UNLICENSED' }
  s.author         = 'Nolume'
  s.homepage       = 'https://10003.nl'
  s.platforms      = { :ios => '16.4' }
  s.source         = { :path => '.' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.weak_frameworks = 'FoundationModels'
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
  s.source_files = '**/*.{h,m,mm,swift}'
end
