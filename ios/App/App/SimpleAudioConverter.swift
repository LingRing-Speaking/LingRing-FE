import Foundation
import AVFoundation
import WebRTC

// HW PCM format (보통 32-bit float, non-interleaved) ↔ WebRTC PCM format (16-bit int, interleaved) 변환.
// AudioRecordingADM 의 AVAudioSinkNode block 에서 사용.
//
// 패턴 reference: mstyura/RTCAudioDevice/CustomRTCAudioDevice/SimpleAudioConverter.swift
final class SimpleAudioConverter {
    private let converter: AVAudioConverter
    private let inputFormat: AVAudioFormat
    private let outputFormat: AVAudioFormat

    init?(from inputFormat: AVAudioFormat, to outputFormat: AVAudioFormat) {
        guard let converter = AVAudioConverter(from: inputFormat, to: outputFormat) else {
            return nil
        }
        self.converter = converter
        self.inputFormat = inputFormat
        self.outputFormat = outputFormat
    }

    func convert(framesCount: AVAudioFrameCount,
                 from inputData: UnsafePointer<AudioBufferList>,
                 to outputData: UnsafeMutablePointer<AudioBufferList>) -> OSStatus {
        guard let inputBuffer = AVAudioPCMBuffer(pcmFormat: inputFormat, bufferListNoCopy: inputData) else {
            return -1
        }
        inputBuffer.frameLength = framesCount

        guard let outputBuffer = AVAudioPCMBuffer(pcmFormat: outputFormat, bufferListNoCopy: outputData) else {
            return -1
        }
        outputBuffer.frameLength = framesCount

        var error: NSError?
        var consumed = false
        let inputBlock: AVAudioConverterInputBlock = { _, status in
            if consumed {
                status.pointee = .endOfStream
                return nil
            }
            consumed = true
            status.pointee = .haveData
            return inputBuffer
        }
        let result = converter.convert(to: outputBuffer, error: &error, withInputFrom: inputBlock)
        return (result == .error) ? -1 : noErr
    }
}
