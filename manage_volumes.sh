#!/bin/bash
# manage_volumes.sh

set -e

PROJECT_NAME="luan_van"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="./backups"
BACKUP_FILE="${PROJECT_NAME}_volumes_${TIMESTAMP}.tar.gz"

# ============================================
# COLORS
# ============================================
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# ============================================
# FUNCTIONS
# ============================================

show_menu() {
  clear
  echo -e "${BLUE}═══════════════════════════════════════${NC}"
  echo -e "${BLUE}  📦 Docker Volume Manager - $PROJECT_NAME${NC}"
  echo -e "${BLUE}═══════════════════════════════════════${NC}\n"
  echo -e "${YELLOW}1.${NC} 📤 Backup tất cả volumes (với chi tiết)"
  echo -e "${YELLOW}2.${NC} 📥 Restore từ backup file"
  echo -e "${YELLOW}3.${NC} 📋 Liệt kê volumes + dung lượng"
  echo -e "${YELLOW}4.${NC} 🗑️  Xóa volumes (NGUY HIỂM!)"
  echo -e "${YELLOW}5.${NC} 📊 Kiểm tra backup files"
  echo -e "${YELLOW}6.${NC} 🌐 Upload sang server (SCP)"
  echo -e "${YELLOW}7.${NC} 🔍 Chi tiết từng volume"
  echo -e "${YELLOW}0.${NC} ❌ Thoát\n"
  echo -n "Chọn tùy chọn [0-7]: "
}

# Kiểm tra volumes có tồn tại không
check_volumes_exist() {
  VOLUMES=$(docker volume ls --filter "name=$PROJECT_NAME" -q)
  if [ -z "$VOLUMES" ]; then
    echo -e "${RED}❌ Không tìm thấy volume nào!${NC}"
    return 1
  fi
  return 0
}

backup_volumes() {
  echo -e "\n${BLUE}🔍 Tìm volumes...${NC}"
  
  if ! check_volumes_exist; then
    return 1
  fi
  
  mkdir -p $BACKUP_DIR
  
  echo -e "${GREEN}✅ Tìm thấy volumes:${NC}"
  echo "$VOLUMES" | nl
  
  echo -e "\n${BLUE}📦 Đang backup chi tiết...${NC}"
  TEMP_DIR=$(mktemp -d)
  BACKUP_COUNT=0
  
  for volume in $VOLUMES; do
    echo -e "\n  ${YELLOW}→ $volume${NC}"
    
    # Kiểm tra dung lượng
    VOL_SIZE=$(docker run --rm -v $volume:/data alpine du -sh /data 2>/dev/null | cut -f1)
    echo -e "    📊 Dung lượng: $VOL_SIZE"
    
    # Kiểm tra số lượng file
    FILE_COUNT=$(docker run --rm -v $volume:/data alpine find /data -type f 2>/dev/null | wc -l)
    echo -e "    📋 Số file: $FILE_COUNT"
    
    # Backup
    echo -e "    ⏳ Đang backup..."
    if docker run --rm \
      -v $volume:/source \
      -v $TEMP_DIR:/backup \
      alpine tar czf /backup/${volume}.tar.gz -C /source . 2>/dev/null; then
      
      BACKUP_SIZE=$(du -h $TEMP_DIR/${volume}.tar.gz | cut -f1)
      echo -e "    ✅ Backup size: $BACKUP_SIZE"
      ((BACKUP_COUNT++))
    else
      echo -e "    ${YELLOW}⚠️  (Volume có thể rỗng)${NC}"
    fi
  done
  
  if [ $BACKUP_COUNT -eq 0 ]; then
    echo -e "\n${RED}❌ Không có volume nào được backup!${NC}"
    rm -rf $TEMP_DIR
    return 1
  fi
  
  echo -e "\n${BLUE}📦 Gom $BACKUP_COUNT volumes lại thành 1 file...${NC}"
  cd $TEMP_DIR
  tar czf $BACKUP_FILE *.tar.gz 2>/dev/null
  cd - > /dev/null
  
  mv $TEMP_DIR/$BACKUP_FILE $BACKUP_DIR/ 2>/dev/null
  rm -rf $TEMP_DIR
  
  SIZE=$(du -h $BACKUP_DIR/$BACKUP_FILE | cut -f1)
  echo -e "\n${GREEN}✅ Backup thành công!${NC}"
  echo -e "  📁 File: ${YELLOW}$BACKUP_DIR/$BACKUP_FILE${NC}"
  echo -e "  📊 Size: ${YELLOW}$SIZE${NC}"
  echo -e "  📦 Số volumes: ${YELLOW}$BACKUP_COUNT${NC}"
}

restore_volumes() {
  echo -e "\n${BLUE}📁 Backup files có sẵn:${NC}"
  if [ ! -d "$BACKUP_DIR" ] || [ -z "$(ls $BACKUP_DIR/*.tar.gz 2>/dev/null)" ]; then
    echo -e "${RED}❌ Không có backup file nào!${NC}"
    return 1
  fi
  
  ls -lh $BACKUP_DIR/*.tar.gz | awk '{print "  " NR ". " $NF " (" $5 ")"}'
  
  echo -n -e "\n${YELLOW}Nhập tên file để restore:${NC} "
  read RESTORE_FILE
  
  if [ ! -f "$BACKUP_DIR/$RESTORE_FILE" ]; then
    echo -e "${RED}❌ File không tìm thấy!${NC}"
    return 1
  fi
  
  echo -e "\n${YELLOW}⚠️  CẢNH BÁO: Sẽ xóa/ghi đè volumes hiện tại!${NC}"
  echo -n "Bạn có chắc chắn? (yes/no): "
  read confirm
  
  if [ "$confirm" != "yes" ]; then
    echo -e "${RED}❌ Hủy bỏ.${NC}"
    return 1
  fi
  
  echo -e "\n${BLUE}📥 Đang restore...${NC}"
  TEMP_DIR=$(mktemp -d)
  
  echo -e "  Extracting backup file..."
  tar xzf $BACKUP_DIR/$RESTORE_FILE -C $TEMP_DIR
  
  RESTORE_COUNT=0
  for tar_file in $TEMP_DIR/*.tar.gz; do
    VOLUME_NAME=$(basename $tar_file .tar.gz)
    echo -e "\n  ${YELLOW}→ $VOLUME_NAME${NC}"
    
    # Xóa volume cũ nếu tồn tại
    if docker volume ls -q | grep -q "^${VOLUME_NAME}$"; then
      echo -e "    Xóa volume cũ..."
      docker volume rm $VOLUME_NAME 2>/dev/null || true
    fi
    
    # Tạo volume mới
    echo -e "    Tạo volume mới..."
    docker volume create $VOLUME_NAME > /dev/null
    
    # Restore dữ liệu
    echo -e "    Đang restore..."
    docker run --rm \
      -v $VOLUME_NAME:/target \
      -v $TEMP_DIR:/backup \
      alpine tar xzf /backup/$(basename $tar_file) -C /target > /dev/null 2>&1
    
    echo -e "    ✅ Done"
    ((RESTORE_COUNT++))
  done
  
  rm -rf $TEMP_DIR
  
  echo -e "\n${GREEN}✅ Restore thành công!${NC}"
  echo -e "  📦 Số volumes: ${YELLOW}$RESTORE_COUNT${NC}"
}

list_volumes() {
  echo -e "\n${BLUE}📋 Volumes của $PROJECT_NAME:${NC}"
  
  if ! check_volumes_exist; then
    return 1
  fi
  
  echo ""
  docker volume ls --filter "name=$PROJECT_NAME" --format "table {{.Name}}\t{{.Driver}}"
  
  echo -e "\n${BLUE}📊 Dung lượng từng volume:${NC}"
  echo ""
  for volume in $VOLUMES; do
    SIZE=$(docker run --rm -v $volume:/data alpine du -sh /data 2>/dev/null | cut -f1)
    FILE_COUNT=$(docker run --rm -v $volume:/data alpine find /data -type f 2>/dev/null | wc -l)
    echo -e "  ${YELLOW}$volume${NC}"
    echo -e "    Size: $SIZE | Files: $FILE_COUNT"
  done
}

delete_volumes() {
  echo -e "\n${RED}🗑️  Xóa volumes - NGUY HIỂM!${NC}"
  
  if ! check_volumes_exist; then
    return 1
  fi
  
  echo -e "${RED}Volumes sẽ bị xóa:${NC}"
  echo "$VOLUMES" | nl
  
  echo -n -e "\n${RED}Gõ 'DELETE' để xác nhận:${NC} "
  read confirm
  
  if [ "$confirm" != "DELETE" ]; then
    echo -e "${YELLOW}❌ Hủy bỏ.${NC}"
    return 1
  fi
  
  echo -e "\n${BLUE}Đang xóa...${NC}"
  for volume in $VOLUMES; do
    echo -e "  ${YELLOW}→ Xóa $volume...${NC}"
    docker volume rm $volume
  done
  
  echo -e "\n${GREEN}✅ Xóa thành công!${NC}"
}

check_backups() {
  echo -e "\n${BLUE}📂 Backup files:${NC}"
  if [ ! -d "$BACKUP_DIR" ] || [ -z "$(ls $BACKUP_DIR/*.tar.gz 2>/dev/null)" ]; then
    echo -e "${RED}❌ Không có backup file nào!${NC}"
    return 1
  fi
  
  echo ""
  ls -lh $BACKUP_DIR/*.tar.gz | awk '{printf "  %-50s %8s\n", $NF, $5}'
  echo ""
  echo -e "${BLUE}📊 Tổng size:${NC} $(du -sh $BACKUP_DIR | cut -f1)"
}

detail_volumes() {
  echo -e "\n${BLUE}🔍 Chi tiết volumes:${NC}"
  
  if ! check_volumes_exist; then
    return 1
  fi
  
  for volume in $VOLUMES; do
    echo -e "\n${YELLOW}═══════════════════════════════════${NC}"
    echo -e "${YELLOW}📁 $volume${NC}"
    echo -e "${YELLOW}═══════════════════════════════════${NC}"
    
    # Dung lượng
    SIZE=$(docker run --rm -v $volume:/data alpine du -sh /data 2>/dev/null | cut -f1)
    echo -e "${BLUE}Size:${NC} $SIZE"
    
    # Số file
    FILE_COUNT=$(docker run --rm -v $volume:/data alpine find /data -type f 2>/dev/null | wc -l)
    echo -e "${BLUE}Files:${NC} $FILE_COUNT"
    
    # Top 10 files lớn nhất
    echo -e "\n${BLUE}Top 10 files lớn nhất:${NC}"
    docker run --rm -v $volume:/data alpine find /data -type f -exec ls -lh {} \; 2>/dev/null | \
      awk '{print $5, $NF}' | sort -hr | head -10 | \
      awk '{printf "  %-10s %s\n", $1, $2}'
    
    # Cấu trúc thư mục
    echo -e "\n${BLUE}Cấu trúc:${NC}"
    docker run --rm -v $volume:/data alpine tree -L 2 -h /data 2>/dev/null | head -20 | sed 's/^/  /'
  done
}

upload_to_server() {
  echo -e "\n${BLUE}🌐 Upload sang server${NC}"
  
  if [ ! -d "$BACKUP_DIR" ] || [ -z "$(ls $BACKUP_DIR/*.tar.gz 2>/dev/null)" ]; then
    echo -e "${RED}❌ Không có backup file nào!${NC}"
    return 1
  fi
  
  echo -e "\n${BLUE}Backup files:${NC}"
  ls -lh $BACKUP_DIR/*.tar.gz | awk '{print "  " NR ". " $NF " (" $5 ")"}'
  
  echo -n -e "\n${YELLOW}Nhập tên file để upload:${NC} "
  read UPLOAD_FILE
  
  if [ ! -f "$BACKUP_DIR/$UPLOAD_FILE" ]; then
    echo -e "${RED}❌ File không tìm thấy!${NC}"
    return 1
  fi
  
  echo -n -e "${YELLOW}Nhập user@host (vd: root@192.168.1.100):${NC} "
  read REMOTE_SERVER
  
  echo -n -e "${YELLOW}Nhập remote path (vd: /tmp):${NC} "
  read REMOTE_PATH
  
  FILE_SIZE=$(du -h $BACKUP_DIR/$UPLOAD_FILE | cut -f1)
  echo -e "\n${BLUE}📤 Đang upload ($FILE_SIZE)...${NC}"
  
  scp -P 22 $BACKUP_DIR/$UPLOAD_FILE $REMOTE_SERVER:$REMOTE_PATH/
  
  echo -e "\n${GREEN}✅ Upload thành công!${NC}"
  echo -e "  📍 Vị trí: ${YELLOW}$REMOTE_SERVER:$REMOTE_PATH/$UPLOAD_FILE${NC}"
  echo -e "\n${BLUE}Để restore trên server:${NC}"
  echo -e "  ${YELLOW}bash manage_volumes.sh${NC}"
  echo -e "  Chọn: 2 (Restore)"
}

# ============================================
# MAIN LOOP
# ============================================

while true; do
  show_menu
  read choice
  
  case $choice in
    1) backup_volumes ;;
    2) restore_volumes ;;
    3) list_volumes ;;
    4) delete_volumes ;;
    5) check_backups ;;
    6) upload_to_server ;;
    7) detail_volumes ;;
    0) echo -e "\n${GREEN}👋 Tạm biệt!${NC}\n"; exit 0 ;;
    *) echo -e "${RED}❌ Tùy chọn không hợp lệ!${NC}" ;;
  esac
  
  echo ""
  echo -n -e "${YELLOW}Nhấn Enter để tiếp tục...${NC}"
  read
done