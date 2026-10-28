import ExpoModulesCore
import Foundation

#if canImport(FoundationModels)
import FoundationModels
#endif

private func listingError(_ code: String, _ message: String) -> Exception {
  Exception(name: "ListingError", description: message, code: code)
}

internal final class ListingFactRecord: Record {
  @Field var label: String = ""
  @Field var value: String = ""
}

internal final class ListingRequestRecord: Record {
  @Field var language: String = "en"
  @Field var facts: [ListingFactRecord] = []
  @Field var photoPaths: [String] = []
  /// Empty keeps the Listing Lab instructions. A style passes its own text.
  @Field var instructions: String = ""
}

#if canImport(FoundationModels)
@available(iOS 26.0, *)
@Generable
struct ListingCopy {
  @Guide(description: "Marketplace title, at most 80 characters. Only confirmed facts.")
  var listingTitle: String

  @Guide(description: "The marketplace description. Follow the session instructions for tone and length. No price, shipping, or warranty.")
  var listingDescription: String

  @Guide(description: "Things noticed but not confirmed. Empty if none.")
  var uncertainObservations: [String]
}
#endif

public final class NolumeFoundationModelsModule: Module {
  private var work: Task<[String: Any], Error>?
  private var generation = 0

  public func definition() -> ModuleDefinition {
    Name("NolumeFoundationModels")

    AsyncFunction("getListingAvailability") {
      Self.availability()
    }

    AsyncFunction("generateListing") { (request: ListingRequestRecord) async throws -> [String: Any] in
      self.work?.cancel()
      self.generation += 1
      let mine = self.generation
      let task = Task { try await Self.run(request) }
      self.work = task
      do {
        let value = try await task.value
        if self.generation == mine {
          self.work = nil
        }
        return value
      } catch {
        if self.generation == mine {
          self.work = nil
        }
        throw Self.mapped(error)
      }
    }

    Function("cancelListingGeneration") {
      self.generation += 1
      self.work?.cancel()
      self.work = nil
    }
  }

  private static func availability() -> [String: Any] {
    #if canImport(FoundationModels)
    if #available(iOS 26.0, *) {
      let model = SystemLanguageModel.default
      switch model.availability {
      case .available:
        var vision = false
        var contextSize = model.contextSize
        if #available(iOS 27.0, *) {
          vision = model.capabilities.contains(.vision)
          contextSize = model.contextSize
        }
        return [
          "state": "ready",
          "vision": vision,
          "contextSize": contextSize,
          "supportsEnglish": model.supportsLocale(Locale(identifier: "en")),
          "supportsDutch": model.supportsLocale(Locale(identifier: "nl")),
        ]
      case .unavailable(.deviceNotEligible):
        return ["state": "unavailable", "reason": "deviceNotEligible"]
      case .unavailable(.appleIntelligenceNotEnabled):
        return ["state": "unavailable", "reason": "appleIntelligenceNotEnabled"]
      case .unavailable(.modelNotReady):
        return ["state": "unavailable", "reason": "modelNotReady"]
      case .unavailable:
        return ["state": "unavailable", "reason": "deviceNotEligible"]
      }
    }
    #endif
    return ["state": "unsupported"]
  }

  private static func run(_ request: ListingRequestRecord) async throws -> [String: Any] {
    try Task.checkCancellation()

    #if canImport(FoundationModels)
    guard #available(iOS 26.0, *) else {
      throw listingError("unsupported", "Foundation Models need iOS 26 or later.")
    }

    let model = SystemLanguageModel.default
    switch model.availability {
    case .available:
      break
    case .unavailable(.deviceNotEligible):
      throw listingError("deviceNotEligible", "This iPhone cannot run Apple Intelligence.")
    case .unavailable(.appleIntelligenceNotEnabled):
      throw listingError("appleIntelligenceNotEnabled", "Turn on Apple Intelligence in Settings.")
    case .unavailable(.modelNotReady):
      throw listingError("modelNotReady", "Apple Intelligence is still preparing on this iPhone.")
    case .unavailable:
      throw listingError("deviceNotEligible", "The on-device model is not available.")
    }

    var vision = false
    if #available(iOS 27.0, *) {
      vision = model.capabilities.contains(.vision)
    }

    let urls = try request.photoPaths.map(localFileURL)
    if !urls.isEmpty && !vision {
      throw listingError("visionUnavailable", "This iPhone can generate from the product facts, not from photos.")
    }

    let language = request.language == "nl" ? "nl" : "en"
    let custom = request.instructions.trimmingCharacters(in: .whitespacesAndNewlines)
    let prompt = custom.isEmpty ? promptText(language: language, facts: request.facts) : confirmedFacts(language: language, facts: request.facts)
    let options = GenerationOptions(maximumResponseTokens: 400)
    let session = LanguageModelSession(instructions: custom.isEmpty ? instructions(language: language) : custom)
    let started = Date()
    let response: LanguageModelSession.Response<ListingCopy>
    let attached: Int

    if urls.isEmpty {
      response = try await generateText(session: session, prompt: prompt, options: options)
      attached = 0
    } else if #available(iOS 27.0, *) {
      response = try await generateVision(session: session, prompt: prompt, urls: urls, options: options)
      attached = urls.count
    } else {
      throw listingError("visionUnavailable", "This iPhone can generate from the product facts, not from photos.")
    }

    try Task.checkCancellation()

    let copy = response.content
    var inputTokens: Int? = nil
    var outputTokens: Int? = nil
    if #available(iOS 27.0, *) {
      inputTokens = response.usage.input.totalTokenCount
      outputTokens = response.usage.output.totalTokenCount
    } else if #available(iOS 26.4, *) {
      inputTokens = try? await model.tokenCount(for: Prompt(prompt))
      outputTokens = try? await model.tokenCount(for: Prompt("\(copy.listingTitle)\n\(copy.listingDescription)"))
    }

    let elapsedMs = Int((Date().timeIntervalSince(started) * 1000).rounded())
    var payload: [String: Any] = [
      "listingTitle": copy.listingTitle,
      "listingDescription": copy.listingDescription,
      "uncertainObservations": copy.uncertainObservations,
      "elapsedMs": elapsedMs,
      "photosAttached": attached,
    ]
    if let inputTokens {
      payload["inputTokens"] = inputTokens
    } else {
      payload["inputTokens"] = NSNull()
    }
    if let outputTokens {
      payload["outputTokens"] = outputTokens
    } else {
      payload["outputTokens"] = NSNull()
    }
    return payload
    #else
    throw listingError("unsupported", "Foundation Models are not in this SDK.")
    #endif
  }

  #if canImport(FoundationModels)
  @available(iOS 26.0, *)
  private static func generateText(
    session: LanguageModelSession,
    prompt: String,
    options: GenerationOptions
  ) async throws -> LanguageModelSession.Response<ListingCopy> {
    try await session.respond(to: prompt, generating: ListingCopy.self, options: options)
  }

  @available(iOS 27.0, *)
  private static func generateVision(
    session: LanguageModelSession,
    prompt: String,
    urls: [URL],
    options: GenerationOptions
  ) async throws -> LanguageModelSession.Response<ListingCopy> {
    let built = Prompt {
      prompt
      for url in urls {
        Attachment(imageURL: url)
      }
    }
    return try await session.respond(to: built, generating: ListingCopy.self, options: options)
  }

  @available(iOS 26.0, *)
  private static func instructions(language: String) -> String {
    let tongue = language == "nl" ? "Dutch" : "English"
    return """
    You write marketplace listings for a second-hand item.

    Use only the labeled facts. Photos, when present, are for visible characteristics.
    Do not invent a brand, material, size, measurement, age, authenticity, defect, or the absence of defects.
    A logo in a photo is not proof that the item is authentic.
    If something is uncertain, leave it out of the title and description and mention it only in uncertainObservations.
    Do not mention price, shipping, or warranty.
    Write listingTitle and listingDescription in \(tongue).
    Keep the title practical and under 80 characters.
    Write a short, natural description. No marketing filler.
    The product name is the seller's internal name, not the marketplace title.
    """
  }

  @available(iOS 26.0, *)
  private static func promptText(language: String, facts: [ListingFactRecord]) -> String {
    let tongue = language == "nl" ? "Dutch" : "English"
    return (["Write a \(tongue) marketplace listing from these confirmed facts."] + factLines(facts)).joined(separator: "\n")
  }

  /// Facts only. The style instructions already say how to write.
  @available(iOS 26.0, *)
  private static func confirmedFacts(language: String, facts: [ListingFactRecord]) -> String {
    let tongue = language == "nl" ? "Dutch" : "English"
    return (["Confirmed facts. Requested description language: \(tongue)."] + factLines(facts)).joined(separator: "\n")
  }

  private static func factLines(_ facts: [ListingFactRecord]) -> [String] {
    var lines: [String] = []

    for fact in facts {
      let label = fact.label.trimmingCharacters(in: .whitespacesAndNewlines)
      let value = fact.value.trimmingCharacters(in: .whitespacesAndNewlines)
      if label.isEmpty || value.isEmpty {
        continue
      }
      lines.append("\(label): \(value)")
    }

    return lines
  }
  #endif

  private static func localFileURL(_ path: String) throws -> URL {
    let trimmed = path.trimmingCharacters(in: .whitespacesAndNewlines)
    if trimmed.isEmpty {
      throw listingError("invalidPhoto", "A photo path was empty.")
    }
    if let parsed = URL(string: trimmed), let scheme = parsed.scheme?.lowercased() {
      if scheme == "http" || scheme == "https" || scheme == "data" {
        throw listingError("invalidPhoto", "Photos must be local files.")
      }
      if scheme == "file" {
        return try existingFile(parsed.standardizedFileURL)
      }
    }
    return try existingFile(URL(fileURLWithPath: trimmed).standardizedFileURL)
  }

  private static func existingFile(_ url: URL) throws -> URL {
    guard url.isFileURL else {
      throw listingError("invalidPhoto", "Photos must be local files.")
    }
    guard FileManager.default.fileExists(atPath: url.path) else {
      throw listingError("missingPhoto", "A product photo was not on this iPhone.")
    }
    return url
  }

  private static func mapped(_ error: Error) -> Exception {
    if error is CancellationError || Task.isCancelled {
      return listingError("cancelled", "Generation was cancelled.")
    }
    if let exception = error as? Exception {
      return exception
    }
    #if canImport(FoundationModels)
    if #available(iOS 27.0, *) {
      if let modelError = error as? LanguageModelError {
        switch modelError {
        case .contextSizeExceeded:
          return listingError("contextSizeExceeded", "The listing request was too large for the on-device model.")
        case .guardrailViolation:
          return listingError("guardrailViolation", "Apple Intelligence declined this listing request.")
        case .refusal:
          return listingError("refusal", "Apple Intelligence refused to write this listing.")
        case .unsupportedLanguageOrLocale:
          return listingError("unsupportedLanguageOrLocale", "The on-device model does not support that language.")
        case .rateLimited:
          return listingError("rateLimited", "The on-device model is busy. Try again in a moment.")
        case .unsupportedCapability:
          return listingError("visionUnavailable", "This iPhone cannot use that generation capability.")
        case .timeout:
          return listingError("timeout", "Generation timed out.")
        default:
          break
        }
      }
      if let sessionError = error as? LanguageModelSession.Error {
        switch sessionError {
        case .concurrentRequests:
          return listingError("concurrentRequests", "Wait for the current generation to finish.")
        default:
          break
        }
      }
      if let systemError = error as? SystemLanguageModel.Error {
        switch systemError {
        case .assetsUnavailable:
          return listingError("assetsUnavailable", "The on-device model is not downloaded yet.")
        }
      }
    }
    if #available(iOS 26.0, *) {
      if let generation = error as? LanguageModelSession.GenerationError {
        switch generation {
        case .exceededContextWindowSize:
          return listingError("contextSizeExceeded", "The listing request was too large for the on-device model.")
        case .assetsUnavailable:
          return listingError("assetsUnavailable", "The on-device model is not downloaded yet.")
        case .guardrailViolation:
          return listingError("guardrailViolation", "Apple Intelligence declined this listing request.")
        case .unsupportedLanguageOrLocale:
          return listingError("unsupportedLanguageOrLocale", "The on-device model does not support that language.")
        case .rateLimited:
          return listingError("rateLimited", "The on-device model is busy. Try again in a moment.")
        case .concurrentRequests:
          return listingError("concurrentRequests", "Wait for the current generation to finish.")
        case .refusal:
          return listingError("refusal", "Apple Intelligence refused to write this listing.")
        default:
          break
        }
      }
    }
    #endif
    return listingError("generationFailed", error.localizedDescription)
  }
}
