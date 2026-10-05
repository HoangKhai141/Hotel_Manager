import { prisma } from "config/client";
import { RoomStatus } from "@prisma/client";

const handleCreateRoom = async (
    name: string,
    type: string,
    price: number,
    capacity: number,
    description: string | null,
    image: string | null,
    status: RoomStatus
) => {
    const newRoom = await prisma.room.create({
        data: {
            name: name,
            type: type,
            price: +price,
            capacity: +capacity,
            description: description,
            image: image,
            status: status || RoomStatus.AVAILABLE
        }
    });
    return newRoom;
}

const getAllRooms = async () => {
    const rooms = await prisma.room.findMany({
        orderBy: { id: 'desc' }
    });
    return rooms;
}

const getRoomById = async (id: string) => {
    const room = await prisma.room.findUnique({ 
        where: { id: +id } 
    });
    return room;
}

const updateRoomById = async (
    id: string,
    name: string,
    type: string,
    price: number,
    capacity: number,
    description: string | null,
    image: string | undefined,
    status: RoomStatus
) => {
    const updatedRoom = await prisma.room.update({
        where: { id: +id },
        data: {
            name: name,
            type: type,
            price: +price,
            capacity: +capacity,
            description: description,
            status: status,
            ...(image !== undefined && { image: image })
        }
    });
    return updatedRoom;
}

const handleDeleteRoom = async (id: string) => {
    // Check if room has bookings
    const roomBookings = await prisma.roomBooking.findMany({
        where: { roomId: +id }
    });

    if (roomBookings.length > 0) {
        throw new Error("Cannot delete room with existing bookings");
    }

    const result = await prisma.room.delete({
        where: { id: +id }
    });
    return result;
}

export {
    handleCreateRoom,
    getAllRooms,
    getRoomById,
    updateRoomById,
    handleDeleteRoom
}