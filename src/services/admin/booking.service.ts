// ==================== src/services/admin/booking.service.ts (COMPLETE) ====================
import { prisma } from "../../config/client";
import { BookingStatus, RoomStatus, Prisma } from "@prisma/client";

// ==================== INTERFACES ====================
interface CreateBookingData {
    guestName: string;
    guestPhone: string;
    guestEmail?: string | null;
    guestCount: number;
    roomId: number;
    checkInDate: Date;
    checkOutDate: Date;
    specialRequest?: string | null;
    userId: number;
}

interface UpdateBookingData {
    guestName?: string;
    guestPhone?: string;
    guestEmail?: string | null;
    guestCount?: number;
    roomId?: number;
    checkInDate?: Date;
    checkOutDate?: Date;
    specialRequest?: string | null;
    status?: BookingStatus;
}

// ==================== HELPER FUNCTIONS ====================

/**
 * Tính số đêm giữa 2 ngày
 */
const calculateNights = (checkIn: Date, checkOut: Date): number => {
    const msPerDay = 24 * 60 * 60 * 1000;
    const diffTime = Math.max(checkOut.getTime() - checkIn.getTime(), 0);
    const nights = Math.ceil(diffTime / msPerDay);
    return nights === 0 && diffTime > 0 ? 1 : nights;
};

/**
 * Validate ngày check-in và check-out
 */
const validateDates = (checkIn: Date, checkOut: Date, allowPast = false) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const checkInDay = new Date(checkIn.getFullYear(), checkIn.getMonth(), checkIn.getDate());

    if (!allowPast && checkInDay < today) {
        throw new Error("Ngày nhận phòng không thể là ngày trong quá khứ.");
    }
    if (checkOut <= checkIn) {
        throw new Error("Ngày trả phòng phải sau ngày nhận phòng.");
    }
    const nights = calculateNights(checkIn, checkOut);
    if (nights <= 0) throw new Error("Số đêm phải lớn hơn 0.");
    if (nights > 365) throw new Error("Booking không thể vượt quá 365 đêm.");
};

/**
 * Kiểm tra phòng có available trong khoảng thời gian không
 */
const isRoomAvailable = async (
    roomId: number,
    checkIn: Date,
    checkOut: Date,
    excludeBookingId?: number
): Promise<boolean> => {
    try {
        const conflictBooking = await prisma.booking.findFirst({
            where: {
                roomId,
                status: {
                    in: [BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN]
                },
                checkOutDate: { gt: checkIn },
                checkInDate: { lt: checkOut },
                ...(excludeBookingId && { id: { not: excludeBookingId } })
            }
        });
        return !conflictBooking;
    } catch (error) {
        console.error("[Service] Error checking availability:", error);
        throw new Error("Lỗi khi kiểm tra tình trạng phòng.");
    }
};

/**
 * Tự động chuyển booking quá hạn sang CHECKED_OUT
 */
const autoCheckOutExpiredBookings = async (tx: any) => {
    const now = new Date();
    
    const expiredBookings = await tx.booking.findMany({
        where: {
            status: { in: [BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN] },
            checkOutDate: { lt: now }
        },
        include: {
            roomBookings: { select: { roomId: true } }
        }
    });

    if (expiredBookings.length === 0) return;

    console.log(`[Service] 🔄 Auto checking out ${expiredBookings.length} expired bookings`);

    for (const booking of expiredBookings) {
        // Update booking status
        await tx.booking.update({
            where: { id: booking.id },
            data: { status: BookingStatus.CHECKED_OUT }
        });

        console.log(`[Service] ✅ Auto checked out booking #${booking.id}`);

        // Free room if no other active bookings
        const roomId = booking.roomBookings[0]?.roomId;
        if (roomId) {
            const otherActiveBookings = await tx.booking.findFirst({
                where: {
                    roomId: roomId,
                    id: { not: booking.id },
                    status: { in: [BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN] }
                }
            });

            if (!otherActiveBookings) {
                await tx.room.update({
                    where: { id: roomId },
                    data: { status: RoomStatus.AVAILABLE }
                });
                console.log(`[Service] ✅ Auto freed room ${roomId}`);
            }
        }
    }
};

// ==================== CRUD OPERATIONS ====================

/**
 * Lấy danh sách tất cả bookings (có filter theo status)
 */
const getAllBookings = async (statusFilter?: BookingStatus) => {
    try {
        // Auto check-out expired bookings trước khi load
        await prisma.$transaction(async (tx) => {
            await autoCheckOutExpiredBookings(tx);
        });

        let where: Prisma.BookingWhereInput = {};
        if (statusFilter) {
            where = { status: statusFilter };
        }

        const bookings = await prisma.booking.findMany({
            where,
            include: {
                user: { select: { id: true, fullName: true, phone: true, username: true } },
                roomBookings: { include: { room: { select: { id: true, name: true, type: true } } } },
                payment: { select: { id: true, paymentStatus: true } }
            },
            orderBy: { createdAt: 'desc' }
        });

        console.log(`[Service] Loaded ${bookings.length} bookings${statusFilter ? ` with status ${statusFilter}` : ''}`);
        return bookings;
    } catch (error) {
        console.error("[Service] Error fetching bookings:", error);
        throw new Error("Không thể tải danh sách đặt phòng.");
    }
};

/**
 * Lấy booking theo ID
 */
const getBookingById = async (id: number) => {
    try {
        const booking = await prisma.booking.findUnique({
            where: { id },
            include: {
                user: { select: { id: true, fullName: true, phone: true, username: true } },
                roomBookings: { include: { room: true } },
                payment: true
            }
        });
        return booking;
    } catch (error) {
        console.error(`[Service] Error fetching booking ${id}:`, error);
        throw new Error("Không thể tải chi tiết đặt phòng.");
    }
};

/**
 * Lấy danh sách phòng available cho admin
 */
const getRoomsForAdminBooking = async () => {
    try {
        const rooms = await prisma.room.findMany({
            where: {
                status: {
                    in: [RoomStatus.AVAILABLE, RoomStatus.CLEANING]
                }
            },
            select: { id: true, name: true, type: true, price: true, capacity: true },
            orderBy: { name: 'asc' }
        });
        return rooms;
    } catch (error) {
        console.error("[Service] Error fetching available rooms:", error);
        throw new Error("Không thể tải danh sách phòng.");
    }
};

/**
 * Tạo booking mới
 */
const createBooking = async (data: CreateBookingData) => {
    return await prisma.$transaction(async (tx) => {
        console.log(`[Service] Creating booking for room ${data.roomId}`);

        // Validation
        if (!data.guestName || !data.guestPhone || !data.roomId || !data.userId) {
            throw new Error("Thiếu thông tin khách hàng, phòng hoặc người dùng.");
        }
        validateDates(data.checkInDate, data.checkOutDate);

        // Check room
        const room = await tx.room.findUnique({ where: { id: data.roomId } });
        if (!room) throw new Error("Phòng không tồn tại.");
        if (room.capacity < data.guestCount) {
            throw new Error(`Phòng chỉ chứa tối đa ${room.capacity} người.`);
        }
        if (room.status === RoomStatus.MAINTENANCE) {
            throw new Error("Phòng đang được bảo trì.");
        }

        // Check availability
        const available = await isRoomAvailable(data.roomId, data.checkInDate, data.checkOutDate);
        if (!available) {
            throw new Error(`Phòng ${room.name} không còn trống trong khoảng thời gian này.`);
        }

        // Calculate price
        const nights = calculateNights(data.checkInDate, data.checkOutDate);
        if (nights <= 0) throw new Error("Số đêm không hợp lệ.");
        const totalPrice = room.price * nights;

        console.log(`[Service] Creating booking: ${nights} nights x ${room.price} = ${totalPrice}`);

        // Create booking
        const newBooking = await tx.booking.create({
            data: {
                guestName: data.guestName,
                guestPhone: data.guestPhone,
                guestEmail: data.guestEmail,
                guestCount: data.guestCount,
                checkInDate: data.checkInDate,
                checkOutDate: data.checkOutDate,
                specialRequest: data.specialRequest,
                totalPrice,
                status: BookingStatus.PENDING,
                userId: data.userId,
                roomId: data.roomId,
                roomBookings: {
                    create: {
                        roomId: data.roomId,
                        price: room.price,
                        quantity: nights
                    }
                }
            }
        });

        // Update room status to BOOKED
        if (room.status !== RoomStatus.BOOKED) {
            await tx.room.update({
                where: { id: data.roomId },
                data: { status: RoomStatus.BOOKED }
            });
            console.log(`[Service] Room ${data.roomId} marked as BOOKED`);
        }

        console.log(`[Service] ✅ Created booking #${newBooking.id}`);
        return newBooking;
    });
};

/**
 * Cập nhật booking
 */
const updateBooking = async (id: number, data: UpdateBookingData) => {
    return await prisma.$transaction(async (tx) => {
        console.log(`[Service] Updating booking #${id}`);

        // Auto check-out expired bookings first
        await autoCheckOutExpiredBookings(tx);

        // Get current booking
        const currentBooking = await tx.booking.findUnique({
            where: { id },
            include: { roomBookings: true }
        });
        if (!currentBooking) throw new Error("Booking không tồn tại.");

        const oldStatus = currentBooking.status;
        const newStatus = data.status;
        const oldRoomId = currentBooking.roomBookings?.[0]?.roomId;
        const newRoomId = data.roomId;
        const checkIn = data.checkInDate || currentBooking.checkInDate;
        const checkOut = data.checkOutDate || currentBooking.checkOutDate;
        let requiresAvailabilityCheck = false;
        let requiresRoomUpdate = false;

        // Validate Status Transition (Relaxed for admin)
        if (newStatus && newStatus !== oldStatus) {
            const validTransitions: Record<BookingStatus, BookingStatus[]> = {
                'PENDING': [BookingStatus.CONFIRMED, BookingStatus.CANCELLED],
                'CONFIRMED': [BookingStatus.CHECKED_IN, BookingStatus.CANCELLED, BookingStatus.CHECKED_OUT],
                'CHECKED_IN': [BookingStatus.CHECKED_OUT, BookingStatus.CANCELLED],
                'CHECKED_OUT': [BookingStatus.CONFIRMED],
                'CANCELLED': [BookingStatus.PENDING]
            };
            
            if (!validTransitions[oldStatus]?.includes(newStatus)) {
                throw new Error(`Không thể chuyển từ ${oldStatus} sang ${newStatus}.`);
            }
            requiresRoomUpdate = true;
            console.log(`[Service] Status change: ${oldStatus} → ${newStatus}`);
        }

        // Validate Dates (allow past for admin)
        if (data.checkInDate || data.checkOutDate) {
            if (checkOut <= checkIn) {
                throw new Error("Ngày trả phòng phải sau ngày nhận phòng.");
            }
            const nights = calculateNights(checkIn, checkOut);
            if (nights <= 0) throw new Error("Số đêm phải lớn hơn 0.");
            if (nights > 365) throw new Error("Booking không thể vượt quá 365 đêm.");
            requiresAvailabilityCheck = true;
        }

        // Validate Room Change
        if (newRoomId && oldRoomId !== newRoomId) {
            const newRoom = await tx.room.findUnique({ where: { id: newRoomId } });
            if (!newRoom) throw new Error("Phòng mới không tồn tại.");
            if (newRoom.status === RoomStatus.MAINTENANCE) {
                throw new Error("Phòng mới đang bảo trì.");
            }
            
            const guestCount = data.guestCount || currentBooking.guestCount;
            if (newRoom.capacity < guestCount) {
                throw new Error(`Phòng mới chỉ chứa ${newRoom.capacity} người.`);
            }

            requiresAvailabilityCheck = true;
            requiresRoomUpdate = true;
            console.log(`[Service] Room change: ${oldRoomId} → ${newRoomId}`);
        }

        // Check Availability
        const finalRoomId = newRoomId || oldRoomId;
        if (requiresAvailabilityCheck && finalRoomId) {
            const available = await isRoomAvailable(finalRoomId, checkIn, checkOut, id);
            if (!available) {
                throw new Error(`Phòng không còn trống cho khoảng thời gian này.`);
            }
        }

        // Prepare update data
        const updateData: Prisma.BookingUpdateInput = {};
        
        if (data.guestName !== undefined) updateData.guestName = data.guestName;
        if (data.guestPhone !== undefined) updateData.guestPhone = data.guestPhone;
        if (data.guestEmail !== undefined) updateData.guestEmail = data.guestEmail;
        if (data.guestCount !== undefined) updateData.guestCount = data.guestCount;
        if (data.checkInDate) updateData.checkInDate = data.checkInDate;
        if (data.checkOutDate) updateData.checkOutDate = data.checkOutDate;
        if (data.specialRequest !== undefined) updateData.specialRequest = data.specialRequest;
        if (newStatus) updateData.status = newStatus;

        if (newRoomId && newRoomId !== oldRoomId) {
            updateData.Room = { connect: { id: newRoomId } };
        }

        // Recalculate totalPrice if needed
        const roomOrDatesChanged = (data.checkInDate || data.checkOutDate || (newRoomId && newRoomId !== oldRoomId));
        if (roomOrDatesChanged && finalRoomId) {
            const roomForPrice = await tx.room.findUniqueOrThrow({
                where: { id: finalRoomId },
                select: { price: true }
            });
            const nights = calculateNights(checkIn, checkOut);
            if (nights > 0) {
                updateData.totalPrice = roomForPrice.price * nights;
                console.log(`[Service] Recalculated price: ${nights} x ${roomForPrice.price} = ${updateData.totalPrice}`);
            }
        }

        // Update Booking
        const updatedBooking = await tx.booking.update({
            where: { id },
            data: updateData,
        });

        // Update RoomBooking link
        if (newRoomId && newRoomId !== oldRoomId) {
            const roomForPrice = await tx.room.findUniqueOrThrow({ where: { id: newRoomId } });
            const nights = calculateNights(checkIn, checkOut);
            await tx.roomBooking.updateMany({
                where: { bookingId: id },
                data: {
                    roomId: newRoomId,
                    price: roomForPrice.price,
                    quantity: nights > 0 ? nights : undefined
                }
            });
        } else if (data.checkInDate || data.checkOutDate) {
            const nights = calculateNights(checkIn, checkOut);
            if (nights > 0 && oldRoomId) {
                await tx.roomBooking.updateMany({
                    where: { bookingId: id, roomId: oldRoomId },
                    data: { quantity: nights }
                });
            }
        }

        // Update Room Statuses
        if (requiresRoomUpdate) {
            const finalStatus = newStatus || oldStatus;

            // Free old room if needed
            if (oldRoomId && (
                newRoomId !== oldRoomId ||
                finalStatus === BookingStatus.CANCELLED ||
                finalStatus === BookingStatus.CHECKED_OUT
            )) {
                const otherBookingsOldRoom = await tx.booking.findFirst({
                    where: {
                        roomId: oldRoomId,
                        id: { not: id },
                        status: { in: [BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN] }
                    }
                });
                
                if (!otherBookingsOldRoom) {
                    await tx.room.update({
                        where: { id: oldRoomId },
                        data: { status: RoomStatus.AVAILABLE }
                    });
                    console.log(`[Service] Freed room ${oldRoomId}`);
                }
            }

            // Book new/current room if needed
            const currentRoomIdForStatus = newRoomId || oldRoomId;
            if (currentRoomIdForStatus) {
                if (finalStatus === BookingStatus.CONFIRMED || finalStatus === BookingStatus.CHECKED_IN) {
                    await tx.room.update({
                        where: { id: currentRoomIdForStatus },
                        data: { status: RoomStatus.BOOKED }
                    });
                    console.log(`[Service] Booked room ${currentRoomIdForStatus}`);
                }
            }
        }

        console.log(`[Service] ✅ Updated booking #${id}`);
        return updatedBooking;
    });
};

/**
 * Xóa booking
 */
const deleteBooking = async (id: number) => {
    return await prisma.$transaction(async (tx) => {
        console.log(`[Service] Deleting booking #${id}`);

        // Find booking
        const booking = await tx.booking.findUnique({
            where: { id },
            select: { 
                status: true, 
                roomBookings: { select: { roomId: true } } 
            }
        });

        if (!booking) {
            throw new Error("Booking không tồn tại.");
        }

        // Only allow deletion for PENDING or CANCELLED
        if (booking.status !== BookingStatus.PENDING && booking.status !== BookingStatus.CANCELLED) {
            throw new Error(
                `Không thể xóa booking ở trạng thái ${booking.status}. Chỉ xóa được khi PENDING hoặc CANCELLED.`
            );
        }

        const roomId = booking.roomBookings?.[0]?.roomId;

        // Delete related records
        await tx.payment.deleteMany({ where: { bookingId: id } });
        await tx.roomBooking.deleteMany({ where: { bookingId: id } });
        await tx.bookingService.deleteMany({ where: { bookingId: id } });

        // Delete booking
        await tx.booking.delete({ where: { id } });

        console.log(`[Service] ✅ Deleted booking #${id}`);

        // Update room status if needed
        if (roomId) {
            const otherBookings = await tx.booking.findFirst({
                where: {
                    roomId: roomId,
                    status: { in: [BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN, BookingStatus.PENDING] }
                }
            });
            
            if (!otherBookings) {
                await tx.room.update({
                    where: { id: roomId },
                    data: { status: RoomStatus.AVAILABLE }
                });
                console.log(`[Service] ✅ Freed room ${roomId} after deletion`);
            }
        }

        return true;
    });
};

// ==================== EXPORTS ====================
export {
    getAllBookings,
    getBookingById,
    createBooking,
    updateBooking,
    deleteBooking,
    getRoomsForAdminBooking as getAvailableRooms,
    calculateNights,
    validateDates,
    autoCheckOutExpiredBookings
};
                