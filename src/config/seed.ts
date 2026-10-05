import { prisma } from './client';
import bcrypt from 'bcrypt';

const initDatabase = async () => {
    try {
        console.log('Khởi tạo database...');

        // ==================== TẠO ROLES ====================
        const roleCount = await prisma.role.count();
        if (roleCount === 0) {
            console.log('Tạo roles...');
            await prisma.role.createMany({
                data: [
                    { name: 'ADMIN', description: 'Quản trị viên - Full quyền' },
                    { name: 'USER', description: 'Người dùng/Khách hàng thông thường' }
                ],
            });
            console.log('Đã tạo roles');
        } else {
            console.log('Roles đã tồn tại');
        }

        // ==================== TẠO ADMIN USER ====================
        const adminRole = await prisma.role.findUnique({
            where: { name: 'ADMIN' },
        });

        if (adminRole) {
            const adminUser = await prisma.user.findFirst({
                where: { roleId: adminRole.id },
            });

            if (!adminUser) {
                console.log('Tạo tài khoản Admin...');
                const hashedPassword = await bcrypt.hash('admin123', 10);
                await prisma.user.create({
                    data: {
                        username: 'admin@hotel.com',
                        password: hashedPassword,
                        fullName: 'Administrator',
                        accountType: 'SYSTEM',
                        roleId: adminRole.id,
                        phone: '0123456789',
                        address: 'Hà Nội'
                    },
                });
                console.log('Đã tạo Admin');
                console.log('Email: admin@hotel.com');
                console.log('Password: admin123');
            } else {
                console.log('Tài khoản Admin đã tồn tại');
            }
        }

        // ==================== TẠO USER MẪU ====================
        const userRole = await prisma.role.findUnique({
            where: { name: 'USER' },
        });

        if (userRole) {
            const normalUser = await prisma.user.findFirst({
                where: {
                    roleId: userRole.id,
                    username: 'user@example.com'
                },
            });

            if (!normalUser) {
                console.log('Tạo tài khoản User mẫu...');
                const hashedPassword = await bcrypt.hash('user123', 10);
                await prisma.user.create({
                    data: {
                        username: 'user@example.com',
                        password: hashedPassword,
                        fullName: 'Nguyễn Văn A',
                        accountType: 'CUSTOMER',
                        roleId: userRole.id,
                        phone: '0987654321',
                        address: 'Hà Nội, Việt Nam'
                    },
                });
                console.log('Đã tạo User mẫu');
                console.log('Email: user@example.com');
                console.log('Password: user123');
            } else {
                console.log('Tài khoản User mẫu đã tồn tại');
            }
        }

        // ==================== TẠO PHÒNG MẪU ====================
        const roomCount = await prisma.room.count();
        if (roomCount === 0) {
            console.log('Tạo 5 phòng mới từ SQL...');
            await prisma.room.createMany({
                data: [

                    // ===== Tầng 1 =====
                    {
                        name: 'Phòng 101',
                        type: 'Single',
                        price: 500000,
                        image: 'balcony-sencilla.webp',
                        description: 'Phòng đơn hiện đại, thiết kế tối giản với ánh sáng tự nhiên và đầy đủ tiện nghi cơ bản. Lý tưởng cho khách du lịch hoặc công tác một mình.',
                        capacity: 1
                    },
                    {
                        name: 'Phòng 102',
                        type: 'Double',
                        price: 800000,
                        image: '9e8165ea11db2395d1876f47d882102f.jpg',
                        description: 'Phòng đôi ấm cúng với giường lớn, không gian thoáng đãng và phòng tắm riêng. Thích hợp cho các cặp đôi nghỉ dưỡng ngắn ngày.',
                        capacity: 2
                    },
                    {
                        name: 'Phòng 103',
                        type: 'Suite',
                        price: 1500000,
                        image: 'atlantic-hotel-heidelberg-suite-wohnraum-blick-ins-schlafzimmer.jpg',
                        description: 'Phòng Suite sang trọng, có phòng khách riêng, bồn tắm hiện đại và ban công hướng phố. Mang đến trải nghiệm nghỉ dưỡng đẳng cấp.',
                        capacity: 2
                    },
                    {
                        name: 'Phòng 104',
                        type: 'Deluxe',
                        price: 3000000,
                        image: 'deluxetwinpanoramic-S360-desktop.webp',
                        description: 'Phòng Deluxe cao cấp với 2 giường đôi, nội thất gỗ sang trọng và tầm nhìn toàn cảnh thành phố. Lý tưởng cho gia đình hoặc nhóm bạn.',
                        capacity: 4
                    },

                    // ===== Tầng 2 =====
                    {
                        name: 'Phòng 201',
                        type: 'Single',
                        price: 500000,
                        image: 'p3-1.jpg',
                        description: 'Phòng đơn trang nhã với tông màu ấm, có bàn làm việc và wifi tốc độ cao. Thích hợp cho khách công tác hoặc nghỉ ngắn.',
                        capacity: 1
                    },
                    {
                        name: 'Phòng 202',
                        type: 'Double',
                        price: 800000,
                        image: 'double.jpeg',
                        description: 'Phòng đôi tiện nghi, có cửa sổ lớn nhìn ra khu vườn. Không gian yên tĩnh và thư giãn cho các cặp đôi.',
                        capacity: 2
                    },
                    {
                        name: 'Phòng 203',
                        type: 'Suite',
                        price: 1500000,
                        image: 'vhGowJ4h7-3j7qQUxwFdWRn--MfI2TPYKyUFZ952UMcSwtpWgnh_BiAA4JDfVe9rX1MJma47fmCVSC5C_-I3m4Fma1KbpLUuefL7mbf41NEzse9kO6d2iDt-cijgpiiuKIA3p5Duhy8qMnA_DnIhZg.jpg',
                        description: 'Suite cao cấp với phòng khách, khu làm việc riêng và minibar. Phong cách hiện đại và thoải mái cho kỳ nghỉ dài.',
                        capacity: 2
                    },
                    {
                        name: 'Phòng 204',
                        type: 'Deluxe',
                        price: 3000000,
                        image: 'EKhLrgI5b-Fb1tnN_gbL-RiSK4U7SnIiRi_oO9bVw2Vvf7JY7dXoT3fs7QyZxVUnUMuWDMSjYXrJcb2FBb4jghM8TtT6XzrCH60CeIOFpL0gu3O1hQt-L-iZoX6ztufYnFNigZnbCH7nbXEBOKkWZg.jpg',
                        description: 'Phòng Deluxe rộng rãi với ban công riêng, phòng tắm đá cẩm thạch và sofa thư giãn. Mang lại cảm giác sang trọng và riêng tư.',
                        capacity: 4
                    },

                    // ===== Tầng 3 =====
                    {
                        name: 'Phòng 301',
                        type: 'Single',
                        price: 500000,
                        image: 'One-Bedoom-City-View-Suite-scaled.jpg',
                        description: 'Phòng đơn thoáng mát, nội thất gọn gàng và giường êm ái. View đẹp nhìn ra thành phố, phù hợp cho khách đi một mình.',
                        capacity: 1
                    },
                    {
                        name: 'Phòng 302',
                        type: 'Double',
                        price: 800000,
                        image: 'chamber-double.jpg',
                        description: 'Phòng đôi hiện đại với không gian mở, ánh sáng tự nhiên và đầy đủ tiện nghi, phù hợp cho kỳ nghỉ lãng mạn.',
                        capacity: 2
                    },
                    {
                        name: 'Phòng 303',
                        type: 'Suite',
                        price: 1500000,
                        image: 'Park-Hyatt-New-York-Manhattan-Sky-Suite-Master-Bedroom-Central-Park-View.jpg',
                        description: 'Phòng Suite cao cấp với thiết kế hiện đại, có phòng khách riêng và bồn tắm lớn. Mang lại trải nghiệm nghỉ dưỡng sang trọng.',
                        capacity: 2
                    },
                    {
                        name: 'Phòng 304',
                        type: 'Deluxe',
                        price: 3000000,
                        image: '1920-1280.png',
                        description: 'Phòng Deluxe đẳng cấp, có khu vực tiếp khách và view hồ bơi. Trang bị tiện nghi cao cấp cho kỳ nghỉ thoải mái nhất.',
                        capacity: 4
                    }

                ],
                skipDuplicates: true,
            });
            console.log('Đã tạo 5 phòng mới.');
        } else {
            console.log('Phòng đã tồn tại');
        }



        // ==================== TẠO DỊCH VỤ MẪU ====================
        const serviceCount = await prisma.service.count();
        if (serviceCount === 0) {
            console.log('Tạo dịch vụ mẫu...');
            await prisma.service.createMany({
                data: [
                    {
                        name: 'Dịch vụ phòng',
                        price: 50000,
                        shortDesc: 'Giao đồ ăn uống tận phòng',
                        description: 'Dịch vụ phòng 24/7 với thực đơn phong phú',
                        isActive: true
                    },
                    {
                        name: 'Giặt ủi',
                        price: 100000,
                        shortDesc: 'Giặt ủi quần áo chuyên nghiệp',
                        description: 'Dịch vụ giặt ủi nhanh trong ngày',
                        isActive: true
                    },
                    {
                        name: 'Đưa đón sân bay',
                        price: 300000,
                        shortDesc: 'Đưa đón sân bay tiện lợi',
                        description: 'Xe riêng đưa đón từ/đến sân bay',
                        isActive: true
                    },
                    {
                        name: 'Spa & Massage',
                        price: 500000,
                        shortDesc: 'Dịch vụ spa thư giãn',
                        description: 'Massage truyền thống và các liệu trình spa',
                        isActive: true
                    }
                ],
            });
            console.log(' Đã tạo 4 dịch vụ mẫu');
        } else {
            console.log('Dịch vụ đã tồn tại');
        }

        console.log('\nDatabase đã sẵn sàng!');
        console.log('\nTài khoản mặc định:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(' ADMIN:');
        console.log('  Email: admin@hotel.com');
        console.log('  Password: admin123');
        console.log(' USER:');
        console.log('  Email: user@example.com');
        console.log('  Password: user123');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    } catch (error) {
        console.error('Lỗi khởi tạo database:', error);
        throw error;
    }
};

export default initDatabase;

