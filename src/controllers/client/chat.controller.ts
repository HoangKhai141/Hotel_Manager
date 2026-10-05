import { Request, Response } from "express";
import Groq from "groq-sdk";
import { prisma } from "../../config/client"; // Import prisma để lấy dữ liệu phòng

// Khởi tạo Groq
const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY,
});

export const handleChatRequest = async (req: Request, res: Response) => {
    const { message, history } = req.body; // history là lịch sử chat để bot nhớ ngữ cảnh

    try {
        // 1. Lấy thông tin phòng mới nhất từ DB để "dạy" cho Bot
        const rooms = await prisma.room.findMany({
            select: { name: true, type: true, price: true, capacity: true, status: true }
        });

        // 2. Tạo "System Prompt" - Đây là bộ não của Bot
        // Chúng ta nhúng dữ liệu phòng vào đây để Bot biết thông tin khách sạn
        const roomDataString = rooms.map(r => 
            `- Phòng ${r.name} (${r.type}): ${r.price.toLocaleString('vi-VN')}đ/đêm, tối đa ${r.capacity} người. Trạng thái: ${r.status}`
        ).join("\n");

        const systemPrompt = `
            Bạn là nhân viên lễ tân ảo chuyên nghiệp của khách sạn Hotelier.
            Nhiệm vụ của bạn là hỗ trợ khách hàng đặt phòng, giải đáp thắc mắc thân thiện, ngắn gọn và lịch sự bằng Tiếng Việt.
            
            Dưới đây là danh sách phòng hiện tại của khách sạn:
            ${roomDataString}

            Quy định:
            - Giờ check-in: 14:00, Check-out: 12:00.
            - Nếu khách muốn đặt phòng, hãy hướng dẫn họ bấm vào nút "Đặt Phòng" trên menu.
            - Chỉ trả lời các câu hỏi liên quan đến khách sạn.
            - Trả lời ngắn gọn, dưới 100 từ.
        `;

        // 3. Chuẩn bị messages gửi sang Groq
        // Gồm: System Prompt + Lịch sử chat cũ + Câu hỏi mới nhất
        const conversation = [
            { role: "system", content: systemPrompt },
            ...(history || []), // Lịch sử chat cũ (nếu có)
            { role: "user", content: message }
        ];

        // 4. Gọi API Groq
        const chatCompletion = await groq.chat.completions.create({
            messages: conversation as any,
            model: "llama-3.3-70b-versatile",// Model nhanh và tiếng Việt khá tốt
            temperature: 0.5, // Độ sáng tạo vừa phải để thông tin chính xác
            max_tokens: 300,
        });

        const botReply = chatCompletion.choices[0]?.message?.content || "Xin lỗi, tôi đang gặp sự cố kết nối.";

        return res.json({ reply: botReply });

    } catch (error) {
        console.error("Groq Chat Error:", error);
        return res.status(500).json({ reply: "Hệ thống đang bận, vui lòng thử lại sau." });
    }
};